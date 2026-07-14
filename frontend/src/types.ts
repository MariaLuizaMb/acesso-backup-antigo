export type CategoriaColuna = "texto" | "numero" | "data" | "outro";

export interface ColunaInfo {
  nome: string;
  tipoPostgres: string;
  categoria: CategoriaColuna;
}

export interface TabelaResumo {
  nome: string;
  quantidadeLinhas: number;
}

export interface RespostaDadosTabela {
  tabela: string;
  pagina: number;
  porPagina: number;
  totalLinhas: number;
  totalPaginas: number;
  dados: Record<string, unknown>[];
}
