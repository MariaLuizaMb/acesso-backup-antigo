import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TabelaResumo } from "@/types";

export function useTabelas() {
  return useQuery({
    queryKey: ["tabelas"],
    queryFn: async () => {
      const { data } = await api.get<{ tabelas: TabelaResumo[] }>("/tabelas");
      return data.tabelas;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - a lista de tabelas não muda com frequência
  });
}
