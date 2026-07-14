import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RespostaDadosTabela } from "@/types";

export interface ParametrosConsulta {
  pagina: number;
  porPagina: number;
  busca?: string;
  ordenarPor?: string;
  ordem?: "asc" | "desc";
  filtros?: Record<string, string>;
}

export function useDadosTabela(
  nomeTabela: string | undefined,
  parametros: ParametrosConsulta,
) {
  return useQuery({
    queryKey: ["dados-tabela", nomeTabela, parametros],
    queryFn: async () => {
      const query: Record<string, string> = {
        pagina: String(parametros.pagina),
        porPagina: String(parametros.porPagina),
      };
      if (parametros.busca) query.busca = parametros.busca;
      if (parametros.ordenarPor) query.ordenarPor = parametros.ordenarPor;
      if (parametros.ordem) query.ordem = parametros.ordem;
      if (parametros.filtros) {
        for (const [chave, valor] of Object.entries(parametros.filtros)) {
          if (valor) query[chave] = valor;
        }
      }

      const { data } = await api.get<RespostaDadosTabela>(
        `/tabelas/${nomeTabela}`,
        {
          params: query,
        },
      );
      return data;
    },
    enabled: !!nomeTabela,
    placeholderData: keepPreviousData, // evita "piscar" a tela ao trocar de página/filtro
  });
}
