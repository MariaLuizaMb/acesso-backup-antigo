import { Router, Request, Response } from "express";
import { pool } from "./db";
import {
  listarTabelasComDados,
  buscarTabelaNoCache,
  ColunaInfo,
} from "./schema";

export const tabelasRouter = Router();

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 500;

/**
 * GET /api/tabelas
 * Lista todas as tabelas que têm dados, com a quantidade de linhas de cada uma.
 */
tabelasRouter.get("/", (_req: Request, res: Response) => {
  const tabelas = listarTabelasComDados().map((t) => ({
    nome: t.nome,
    quantidadeLinhas: t.quantidadeLinhas,
  }));
  res.json({ tabelas });
});

/**
 * GET /api/tabelas/:nome/colunas
 * Retorna as colunas de uma tabela específica, com o tipo de dado de cada uma.
 * O frontend usa isso para saber que tipo de campo de filtro mostrar (texto, número, data).
 */
tabelasRouter.get("/:nome/colunas", (req: Request, res: Response) => {
  const tabela = buscarTabelaNoCache(req.params.nome);
  if (!tabela) {
    return res.status(404).json({
      erro: `Tabela "${req.params.nome}" não encontrada ou está vazia.`,
    });
  }
  res.json({ colunas: tabela.colunas });
});

/**
 * GET /api/tabelas/:nome
 *
 * Query params aceitos:
 *   - pagina (padrão 1)
 *   - porPagina (padrão 50, máximo 500)
 *   - ordenarPor (nome de uma coluna existente na tabela)
 *   - ordem ("asc" ou "desc", padrão "asc")
 *   - busca (texto livre, procurado em todas as colunas de texto da tabela)
 *   - qualquer outro parâmetro cujo nome bata com uma coluna vira um filtro específico
 *     daquela coluna (ex: ?NOMECLI=silva&CODCLI=123)
 */
tabelasRouter.get("/:nome", async (req: Request, res: Response) => {
  const tabela = buscarTabelaNoCache(req.params.nome);
  if (!tabela) {
    return res.status(404).json({
      erro: `Tabela "${req.params.nome}" não encontrada ou está vazia.`,
    });
  }

  const query = req.query as Record<string, string | undefined>;

  // --- Paginação ---
  const pagina = Math.max(1, parseInt(query.pagina || "1", 10) || 1);
  const porPaginaSolicitado =
    parseInt(query.porPagina || String(LIMITE_PADRAO), 10) || LIMITE_PADRAO;
  const porPagina = Math.min(Math.max(1, porPaginaSolicitado), LIMITE_MAXIMO);
  const offset = (pagina - 1) * porPagina;

  // --- Ordenação ---
  const nomesColunasValidos = new Set(tabela.colunas.map((c) => c.nome));
  let ordenarPor: string | null = null;
  if (query.ordenarPor && nomesColunasValidos.has(query.ordenarPor)) {
    ordenarPor = query.ordenarPor;
  }
  const ordem = query.ordem?.toLowerCase() === "desc" ? "DESC" : "ASC";

  // --- Monta cláusula WHERE dinamicamente, sempre com valores parametrizados ($1, $2...) ---
  const condicoes: string[] = [];
  const valores: unknown[] = [];

  // Busca livre: procura o texto em todas as colunas de texto da tabela (OR entre elas)
  if (query.busca) {
    const colunasTexto = tabela.colunas.filter((c) => c.categoria === "texto");
    if (colunasTexto.length > 0) {
      valores.push(`%${query.busca}%`);
      const indice = valores.length;
      const condicoesBusca = colunasTexto.map(
        (c) => `"${c.nome}"::text ILIKE $${indice}`,
      );
      condicoes.push(`(${condicoesBusca.join(" OR ")})`);
    }
  }

  // Filtros por coluna específica (qualquer query param que bata com um nome de coluna)
  const parametrosReservados = new Set([
    "pagina",
    "porPagina",
    "ordenarPor",
    "ordem",
    "busca",
  ]);
  for (const [chave, valor] of Object.entries(query)) {
    if (parametrosReservados.has(chave) || valor === undefined || valor === "")
      continue;
    const coluna = tabela.colunas.find((c) => c.nome === chave);
    if (!coluna) continue; // ignora parâmetros que não correspondem a nenhuma coluna

    if (coluna.categoria === "texto") {
      valores.push(`%${valor}%`);
      condicoes.push(`"${coluna.nome}"::text ILIKE $${valores.length}`);
    } else {
      // número ou data
      // Suporta filtros especiais enviados pelo frontend para campos categoria=data:
      // - gt:YYYY-MM-DD  => >= (mais recente/maior)
      // - lt:YYYY-MM-DD  => <= (mais antigo/menor)
      // - eq:YYYY-MM-DD  => igualdade
      // - between:ini,fim => intervalo inclusivo
      if (
        coluna.categoria === "data" &&
        (valor.startsWith("gt:") ||
          valor.startsWith("lt:") ||
          valor.startsWith("eq:") ||
          valor.startsWith("between:"))
      ) {
        if (valor.startsWith("between:")) {
          const rest = valor.replace("between:", "");
          const [ini, fim] = rest.split(",");
          valores.push(ini);
          const iniIdx = valores.length;
          valores.push(fim);
          const fimIdx = valores.length;
          condicoes.push(
            `"${coluna.nome}"::text >= $${iniIdx} AND "${coluna.nome}"::text <= $${fimIdx}`,
          );
        } else {
          const [op, raw] = [valor.split(":")[0], valor.split(":")[1] || ""];
          valores.push(raw);
          const idx = valores.length;
          if (op === "gt") {
            condicoes.push(`"${coluna.nome}"::text >= $${idx}`);
          } else if (op === "lt") {
            condicoes.push(`"${coluna.nome}"::text <= $${idx}`);
          } else {
            // eq
            condicoes.push(`"${coluna.nome}"::text = $${idx}`);
          }
        }
      } else {
        // fallback: igualdade exata
        valores.push(valor);
        condicoes.push(`"${coluna.nome}"::text = $${valores.length}`);
      }
    }
  }

  const whereSql =
    condicoes.length > 0 ? `WHERE ${condicoes.join(" AND ")}` : "";
  const orderBySql = ordenarPor ? `ORDER BY "${ordenarPor}" ${ordem}` : "";

  try {
    const listaColunasSql = tabela.colunas.map((c) => `"${c.nome}"`).join(", ");

    const sqlContagem = `SELECT COUNT(*)::text AS total FROM "${tabela.nome}" ${whereSql}`;
    const sqlDados = `
      SELECT ${listaColunasSql} FROM "${tabela.nome}"
      ${whereSql}
      ${orderBySql}
      LIMIT ${porPagina} OFFSET ${offset}
    `;

    const [resultadoContagem, resultadoDados] = await Promise.all([
      pool.query(sqlContagem, valores),
      pool.query(sqlDados, valores),
    ]);

    const totalLinhas = parseInt(resultadoContagem.rows[0].total, 10);

    res.json({
      tabela: tabela.nome,
      pagina,
      porPagina,
      totalLinhas,
      totalPaginas: Math.ceil(totalLinhas / porPagina),
      dados: resultadoDados.rows,
    });
  } catch (erro) {
    console.error(`Erro ao consultar a tabela ${tabela.nome}:`, erro);
    res.status(500).json({
      erro: "Erro ao consultar os dados. Verifique os filtros informados.",
    });
  }
});
