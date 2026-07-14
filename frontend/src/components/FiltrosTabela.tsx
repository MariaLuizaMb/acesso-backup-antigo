import type { ColunaInfo } from "@/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface FiltrosTabelaProps {
  colunas: ColunaInfo[];
  busca: string;
  onBuscaChange: (valor: string) => void;
  colunaFiltro: string | null;
  onColunaFiltroChange: (coluna: string | null) => void;
  valorFiltro: string;
  onValorFiltroChange: (valor: string) => void;
}

export function FiltrosTabela({
  colunas,
  busca,
  onBuscaChange,
  colunaFiltro,
  onColunaFiltroChange,
  valorFiltro,
  onValorFiltroChange,
}: FiltrosTabelaProps) {
  const colunaInfo = colunas.find((c) => c.nome === colunaFiltro);

  const colunasData = colunas.filter((c) => c.categoria === "data");

  const isData = colunaInfo?.categoria === "data";

  return (
    <div className="flex shrink-0 flex-wrap items-start gap-3 border-b border-border bg-background px-4 py-3 sm:px-6">
      <div className="w-full space-y-1.5 sm:w-auto sm:min-w-[180px] sm:flex-none sm:max-w-[260px]">
        <Label className="cabecalho-coluna">Busca livre</Label>
        <Input
          placeholder="Buscar em todos os campos de texto..."
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
        />
      </div>

      <div className="w-full space-y-1.5 sm:w-48">
        <Label className="cabecalho-coluna">Filtrar coluna</Label>
        <Select
          value={colunaFiltro ?? "__nenhuma__"}
          onValueChange={(valor) =>
            onColunaFiltroChange(valor === "__nenhuma__" ? null : valor)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Nenhuma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__nenhuma__">Nenhuma</SelectItem>
            {colunasData.map((coluna) => (
              <SelectItem key={coluna.nome} value={coluna.nome}>
                {coluna.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {colunaFiltro && !isData && (
        <div className="w-full space-y-1.5 sm:w-56">
          <Label className="cabecalho-coluna">Valor</Label>
          <Input
            placeholder={`Filtrar por ${colunaFiltro}...`}
            value={valorFiltro}
            onChange={(e) => onValorFiltroChange(e.target.value)}
          />
        </div>
      )}

      {colunaFiltro && isData && (
        <div className="flex w-full flex-col gap-2 sm:w-80">
          <div className="space-y-1.5">
            <Label className="cabecalho-coluna">Filtro de data</Label>
            <Select
              value={(() => {
                if (!valorFiltro) return "__igual__";
                if (valorFiltro.startsWith("between:")) return "__intervalo__";
                if (valorFiltro.startsWith("gt:")) return "__mais_antigo__";
                if (valorFiltro.startsWith("lt:")) return "__mais_recente__";
                return "__igual__";
              })()}
              onValueChange={(v) => {
                // Formato armazenado em valorFiltro:
                // "gt:YYYY-MM-DD", "lt:YYYY-MM-DD", "between:ini,fim", "eq:YYYY-MM-DD"
                if (v === "__igual__") return onValorFiltroChange("eq:");
                if (v === "__mais_antigo__") return onValorFiltroChange("gt:");
                if (v === "__mais_recente__") return onValorFiltroChange("lt:");
                if (v === "__intervalo__")
                  return onValorFiltroChange("between:");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__igual__">
                  Mais recente / mais antigo (por igualdade)
                </SelectItem>
                <SelectItem value="__mais_antigo__">
                  Mais antigo (≥ data)
                </SelectItem>
                <SelectItem value="__mais_recente__">
                  Mais recente (≤ data)
                </SelectItem>

                <SelectItem value="__intervalo__">Intervalo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="cabecalho-coluna">Data</Label>
            <Input
              type="date"
              value={(() => {
                const v = valorFiltro || "";
                if (!v) return "";
                if (
                  v.startsWith("gt:") ||
                  v.startsWith("lt:") ||
                  v.startsWith("eq:")
                )
                  return v.split(":")[1] || "";
                if (v.startsWith("between:"))
                  return (v.split(":")[1] || "").split(",")[0] || "";
                return v;
              })()}
              onChange={(e) => {
                const d = e.target.value;
                const base = valorFiltro || "eq:";

                if (base.startsWith("gt:"))
                  return onValorFiltroChange(`gt:${d}`);

                if (base.startsWith("lt:"))
                  return onValorFiltroChange(`lt:${d}`);

                if (base.startsWith("between:")) {
                  const rest = base.replace("between:", "");
                  const [, fim = ""] = rest.split(",");
                  return onValorFiltroChange(`between:${d},${fim}`);
                }

                return onValorFiltroChange(`eq:${d}`);
              }}
            />
          </div>

          {valorFiltro.startsWith("between:") && (
            <div className="space-y-1.5">
              <Label className="cabecalho-coluna">Fim</Label>
              <Input
                type="date"
                value={valorFiltro.replace("between:", "").split(",")[1] || ""}
                onChange={(e) => {
                  const fim = e.target.value;
                  const ini =
                    valorFiltro.replace("between:", "").split(",")[0] || "";
                  onValorFiltroChange(`between:${ini},${fim}`);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
