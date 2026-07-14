"""
Script de migração genérica: Firebird (.gdb) -> PostgreSQL (Supabase)

O que este script faz:
1. Conecta no banco Firebird restaurado
2. Lista TODAS as tabelas de usuário (ignora tabelas de sistema RDB$/MON$)
3. Para cada tabela, descobre as colunas e tipos
4. Cria a tabela equivalente no Postgres (se ainda não existir)
5. Copia todos os dados, linha por linha, em lotes (batches)

Observações:
- Tabelas grandes demais para caber na memória são copiadas em lotes de 1000 linhas.
- Tipos de dados são mapeados de forma conservadora (a maioria vira TEXT, NUMERIC ou TIMESTAMP).
  Isso é intencional: preferimos preservar os dados corretamente a montar tipos "perfeitos".
  Se quiser refinar tipos depois (ex: transformar uma coluna TEXT em INTEGER), isso pode ser
  feito com ALTER TABLE no Postgres depois da migração.
- Nomes de tabelas/colunas do Firebird geralmente vêm em MAIÚSCULAS; o script preserva isso
  entre aspas duplas no Postgres para não perder a correspondência exata.
"""

import os
import sys
import decimal
import datetime
from dotenv import load_dotenv

load_dotenv()

FIREBIRD_DSN = os.environ.get("FIREBIRD_DSN")
FIREBIRD_USER = os.environ.get("FIREBIRD_USER", "SYSDBA")
FIREBIRD_PASSWORD = os.environ.get("FIREBIRD_PASSWORD", "masterkey")
POSTGRES_URL = os.environ.get("POSTGRES_URL")

BATCH_SIZE = 1000

if not FIREBIRD_DSN or not POSTGRES_URL:
    print("ERRO: defina FIREBIRD_DSN e POSTGRES_URL no arquivo .env")
    sys.exit(1)

try:
    import fdb
except ImportError:
    print("ERRO: instale a biblioteca fdb -> pip install fdb --break-system-packages")
    sys.exit(1)

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERRO: instale a biblioteca psycopg2 -> pip install psycopg2-binary --break-system-packages")
    sys.exit(1)


# Mapeamento de tipos Firebird -> Postgres
# Códigos de RDB$FIELD_TYPE do Firebird:
# 7=SMALLINT, 8=INTEGER, 10=FLOAT, 12=DATE, 13=TIME, 14=CHAR, 16=BIGINT/NUMERIC,
# 27=DOUBLE PRECISION, 35=TIMESTAMP, 37=VARCHAR, 261=BLOB
FIREBIRD_TYPE_MAP = {
    7: "SMALLINT",
    8: "INTEGER",
    10: "REAL",
    12: "DATE",
    13: "TIME",
    14: "CHAR",
    16: "NUMERIC",
    27: "DOUBLE PRECISION",
    35: "TIMESTAMP",
    37: "VARCHAR",
    261: "TEXT",  # BLOBs de texto (subtype 1). BLOBs binários (subtype 0) também caem aqui como fallback.
}


def get_firebird_connection():
    return fdb.connect(
        dsn=FIREBIRD_DSN,
        user=FIREBIRD_USER,
        password=FIREBIRD_PASSWORD,
        charset="WIN1252",
    )


def get_postgres_connection():
    return psycopg2.connect(POSTGRES_URL)


def listar_tabelas(fb_cur):
    fb_cur.execute("""
        SELECT TRIM(RDB$RELATION_NAME)
        FROM RDB$RELATIONS
        WHERE RDB$SYSTEM_FLAG = 0
          AND RDB$VIEW_BLR IS NULL
        ORDER BY RDB$RELATION_NAME
    """)
    return [row[0] for row in fb_cur.fetchall()]


def descrever_colunas(fb_cur, tabela):
    """Retorna lista de (nome_coluna, tipo_firebird_code, tamanho, sub_tipo)"""
    fb_cur.execute("""
        SELECT TRIM(rf.RDB$FIELD_NAME), f.RDB$FIELD_TYPE, f.RDB$FIELD_LENGTH, f.RDB$FIELD_SUB_TYPE
        FROM RDB$RELATION_FIELDS rf
        JOIN RDB$FIELDS f ON rf.RDB$FIELD_SOURCE = f.RDB$FIELD_NAME
        WHERE rf.RDB$RELATION_NAME = ?
        ORDER BY rf.RDB$FIELD_POSITION
    """, (tabela,))
    return fb_cur.fetchall()


def tipo_postgres(field_type, sub_type):
    if field_type == 261:
        # BLOB: subtype 1 = texto, subtype 0 = binário genérico
        return "TEXT" if sub_type == 1 else "BYTEA"
    if field_type in (14, 37):
        # CHAR / VARCHAR: usamos TEXT (sem tamanho fixo) para evitar erros de
        # "value too long" causados por diferenças de codificação/charset entre
        # o Firebird antigo e o Postgres. Como este é um banco só de consulta,
        # não precisamos replicar o tamanho exato da coluna original.
        return "TEXT"
    return FIREBIRD_TYPE_MAP.get(field_type, "TEXT")


def criar_tabela_postgres(pg_cur, tabela, colunas):
    cols_sql = ", ".join(
        f'"{nome}" {tipo_postgres(ftype, subtype)}'
        for nome, ftype, length, subtype in colunas
    )
    # Apaga a tabela se já existir (de uma tentativa anterior, possivelmente com
    # schema incorreto) para garantir que ela seja recriada do zero e corretamente.
    pg_cur.execute(f'DROP TABLE IF EXISTS "{tabela}" CASCADE;')
    sql = f'CREATE TABLE "{tabela}" ({cols_sql});'
    pg_cur.execute(sql)


def converter_valor(v, binario=False):
    """Ajustes de tipo para inserção segura no Postgres."""
    if binario:
        # Colunas BYTEA (BLOB binário puro, ex: PDF, imagem) precisam manter os
        # bytes originais intactos - não decodificar como texto.
        if v is None:
            return None
        return psycopg2.Binary(v)
    if isinstance(v, (datetime.date, datetime.datetime, decimal.Decimal)):
        return v
    if isinstance(v, bytes):
        try:
            v = v.decode("latin1")
        except Exception:
            return v
    if isinstance(v, str):
        # Remove caracteres NUL (0x00) - resquício comum de bancos Firebird
        # antigos com campos de tamanho fixo. Postgres não aceita NUL em texto.
        v = v.replace("\x00", "")
    return v


def colunas_binarias(colunas):
    """Retorna lista de booleanos indicando quais colunas são BLOB binário puro (BYTEA)."""
    return [(ftype == 261 and subtype == 0) for _, ftype, length, subtype in colunas]


def migrar_tabela(fb_con, pg_con, tabela):
    fb_cur = fb_con.cursor()
    pg_cur = pg_con.cursor()

    colunas = descrever_colunas(fb_cur, tabela)
    if not colunas:
        print(f"  [aviso] sem colunas encontradas para {tabela}, pulando.")
        return

    criar_tabela_postgres(pg_cur, tabela, colunas)
    pg_con.commit()

    nomes_colunas = [c[0] for c in colunas]
    col_list_sql = ", ".join(f'"{c}"' for c in nomes_colunas)
    placeholders = ", ".join(["%s"] * len(nomes_colunas))
    insert_sql = f'INSERT INTO "{tabela}" ({col_list_sql}) VALUES ({placeholders})'

    fb_cur.execute(f'SELECT {", ".join(nomes_colunas)} FROM "{tabela}"')

    binarias = colunas_binarias(colunas)

    total = 0
    while True:
        rows = fb_cur.fetchmany(BATCH_SIZE)
        if not rows:
            break
        rows_convertidas = [
            tuple(converter_valor(v, binario=binarias[i]) for i, v in enumerate(row))
            for row in rows
        ]
        psycopg2.extras.execute_batch(pg_cur, insert_sql, rows_convertidas)
        pg_con.commit()
        total += len(rows)
        print(f"  ... {total} linhas copiadas de {tabela}")

    print(f"  OK: {tabela} ({total} linhas no total)")


def main():
    # Se você passar nomes de tabelas como argumento, só essas serão migradas.
    # Exemplo: python script_migracao.py EMAILANEXO
    # Exemplo com várias: python script_migracao.py EMAILANEXO EMAIL
    tabelas_especificas = [t.upper() for t in sys.argv[1:]]

    print("Conectando ao Firebird...")
    fb_con = get_firebird_connection()
    print("Conectando ao Postgres (Supabase)...")
    pg_con = get_postgres_connection()

    fb_cur = fb_con.cursor()
    tabelas = listar_tabelas(fb_cur)

    if tabelas_especificas:
        tabelas = [t for t in tabelas if t in tabelas_especificas]
        nao_encontradas = set(tabelas_especificas) - set(tabelas)
        if nao_encontradas:
            print(f"Aviso: tabela(s) não encontrada(s) no Firebird: {', '.join(nao_encontradas)}")
        print(f"\nMigrando {len(tabelas)} tabela(s) selecionada(s): {', '.join(tabelas)}\n")
    else:
        print(f"\n{len(tabelas)} tabelas encontradas no Firebird.\n")

    falhas = []
    for i, tabela in enumerate(tabelas, 1):
        print(f"[{i}/{len(tabelas)}] Migrando {tabela}...")
        try:
            migrar_tabela(fb_con, pg_con, tabela)
        except Exception as e:
            print(f"  ERRO ao migrar {tabela}: {e}")
            falhas.append((tabela, str(e)))
            pg_con.rollback()

    fb_con.close()
    pg_con.close()

    print("\n=== Migração concluída ===")
    if falhas:
        print(f"\n{len(falhas)} tabela(s) com erro:")
        for tabela, erro in falhas:
            print(f"  - {tabela}: {erro}")
    else:
        print("Todas as tabelas migradas sem erros!")


if __name__ == "__main__":
    main()