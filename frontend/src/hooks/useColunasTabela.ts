import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ColunaInfo } from "@/types";

export function useColunasTabela(nomeTabela: string | undefined) {
  return useQuery({
    queryKey: ["colunas", nomeTabela],
    queryFn: async () => {
      const { data } = await api.get<{ colunas: ColunaInfo[] }>(
        `/tabelas/${nomeTabela}/colunas`,
      );
      return data.colunas;
    },
    enabled: !!nomeTabela,
    staleTime: 5 * 60 * 1000,
  });
}
