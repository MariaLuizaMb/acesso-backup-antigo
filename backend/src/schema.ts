import { pool } from "./db";

export interface ColunaInfo {
  nome: string;
  tipoPostgres: string; // ex: "text", "integer", "numeric", "timestamp without time zone"
  categoria: "texto" | "numero" | "data" | "outro";
}

export interface TabelaInfo {
  nome: string;
  quantidadeLinhas: number;
  colunas: ColunaInfo[];
}

// Cache em memória: evita ficar rodando COUNT(*) e introspecção do information_schema
// a cada requisição. É recarregado na inicialização do servidor e pode ser forçado
// a atualizar via endpoint /api/admin/atualizar-cache.
let cacheTabelas: Map<string, TabelaInfo> = new Map();

function categorizarTipo(tipoPostgres: string): ColunaInfo["categoria"] {
  const tipo = tipoPostgres.toLowerCase();
  if (tipo.includes("char") || tipo.includes("text")) return "texto";
  if (
    tipo.includes("int") ||
    tipo.includes("numeric") ||
    tipo.includes("decimal") ||
    tipo.includes("double") ||
    tipo.includes("real")
  )
    return "numero";
  if (tipo.includes("date") || tipo.includes("time")) return "data";
  return "outro";
}

async function listarTodasAsTabelas(): Promise<string[]> {
  const { rows } = await pool.query<{ table_name: string }>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
}

async function buscarColunas(nomeTabela: string): Promise<ColunaInfo[]> {
  const { rows } = await pool.query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
     ORDER BY ordinal_position`,
    [nomeTabela],
  );
  return rows.map((r) => ({
    nome: r.column_name,
    tipoPostgres: r.data_type,
    categoria: categorizarTipo(r.data_type),
  }));
}

async function contarLinhas(nomeTabela: string): Promise<number> {
  // nomeTabela vem sempre de information_schema (não de input do usuário), então
  // é seguro interpolar aqui.
  const { rows } = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM "${nomeTabela}"`,
  );
  return parseInt(rows[0].total, 10);
}

/**
 * Descobre, com uma única query agregada, quais colunas de uma tabela têm pelo
 * menos um valor preenchido (não nulo e não vazio). Colunas sem nenhum dado
 * são descartadas para não poluir a interface com campos sempre em branco.
 */
async function filtrarColunasComDados(
  nomeTabela: string,
  colunas: ColunaInfo[],
): Promise<ColunaInfo[]> {
  if (colunas.length === 0) return [];

  const expressoes = colunas
    .map(
      (c) =>
        `bool_or("${c.nome}" IS NOT NULL AND "${c.nome}"::text <> '') AS "${c.nome}"`,
    )
    .join(", ");

  const { rows } = await pool.query(
    `SELECT ${expressoes} FROM "${nomeTabela}"`,
  );
  const linha = rows[0] as Record<string, boolean>;

  return colunas.filter((c) => linha[c.nome] === true);
}

// Quantidade mínima de linhas para uma tabela aparecer na lista.
const LINHAS_MINIMAS = 11;

// Tabelas permitidas para aparecer no backend/Frontend.
// Obs: comparação é case-insensitive (usamos nome.toUpperCase()).
const TABELAS_PERMITIDAS = new Set([
  "CONTARECEBER",
  "CONTARECEBERREC",
  "ORCAMENTO",
  "ORCAMENTOPROD",
]);

// Tabelas que devem sempre aparecer, independente da quantidade de linhas.
// (mantido para compatibilidade, mas só entra se também estiver em TABELAS_PERMITIDAS)
const TABELAS_SEMPRE_VISIVEIS = new Set(["VENDEDOR"]);

/**
 * Varre todas as tabelas do banco, conta as linhas de cada uma e monta o cache
 * em memória só com as tabelas que têm mais de LINHAS_MINIMAS linhas (exceto
 * as listadas em TABELAS_SEMPRE_VISIVEIS, que aparecem sempre).
 */
export async function atualizarCacheDeTabelas(): Promise<void> {
  console.log("Atualizando cache de tabelas...");
  const nomes = await listarTodasAsTabelas();
  const novoCache = new Map<string, TabelaInfo>();

  for (const nome of nomes) {
    const nomeUpper = nome.toUpperCase();

    // Regra principal: só monta cache para tabelas permitidas.
    if (!TABELAS_PERMITIDAS.has(nomeUpper)) continue;

    const quantidadeLinhas = await contarLinhas(nome);
    const sempreVisivel = TABELAS_SEMPRE_VISIVEIS.has(nomeUpper);

    if (!sempreVisivel && quantidadeLinhas <= LINHAS_MINIMAS) {
      continue; // pula tabelas com poucas linhas (exceto as sempre visíveis)
    }

    const todasAsColunas = await buscarColunas(nome);
    const colunas = await filtrarColunasComDados(nome, todasAsColunas);
    if (colunas.length === 0) {
      continue; // tabela tem linhas, mas nenhuma coluna com dado algum (raro, mas possível)
    }

    novoCache.set(nome, { nome, quantidadeLinhas, colunas });
  }

  cacheTabelas = novoCache;
  console.log(
    `Cache atualizado: ${novoCache.size} de ${nomes.length} tabelas estão disponíveis.`,
  );
}

export function listarTabelasComDados(): TabelaInfo[] {
  return Array.from(cacheTabelas.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );
}

export function buscarTabelaNoCache(
  nomeTabela: string,
): TabelaInfo | undefined {
  // Comparação case-insensitive, já que os nomes originais do Firebird vêm em maiúsculas,
  // mas é mais amigável aceitar o nome em qualquer caixa vindo da URL.
  const nomeUpper = nomeTabela.toUpperCase();
  return Array.from(cacheTabelas.values()).find(
    (t) => t.nome.toUpperCase() === nomeUpper,
  );
}
