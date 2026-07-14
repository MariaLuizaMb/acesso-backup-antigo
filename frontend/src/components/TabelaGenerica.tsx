import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import type { ColunaInfo, RespostaDadosTabela } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface TabelaGenericaProps {
  colunas: ColunaInfo[];
  resposta: RespostaDadosTabela | undefined;
  carregando: boolean;
  pagina: number;
  onPaginaChange: (pagina: number) => void;
  ordenarPor: string | undefined;
  ordem: "asc" | "desc";
  onOrdenarPorChange: (coluna: string) => void;
}

const LIMITE_CARACTERES = 120;

type LinhaDetalhe = {
  index: number;
  dados: Record<string, unknown>;
};

function formatarValorParaExibicao(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return "—";

  const s = String(valor);

  // Formata datas apenas quando o valor realmente parecer ISO/SQL date/datetime.
  // Isso evita que códigos/endereços numéricos sejam interpretados como data.
  const looksLikeDate =
    /^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}(?::\d{2})?)?/.test(s) ||
    /^\d{2}\/\d{2}\/\d{4}/.test(s);

  if (looksLikeDate) {
    const t = Date.parse(s);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      if (d.getFullYear() >= 1900 && d.getFullYear() <= 3000) {
        return new Intl.DateTimeFormat("pt-BR", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: s.includes("T") || s.includes(" ") ? "2-digit" : undefined,
          minute: s.includes("T") || s.includes(" ") ? "2-digit" : undefined,
        }).format(d);
      }
    }
  }

  return s;
}

function truncarTextoParaExibicao(texto: string, limite: number) {
  if (texto.length <= limite) return { texto, truncado: false };
  return { texto: `${texto.slice(0, limite)}…`, truncado: true };
}

function deveOcultarColuna(coluna: ColunaInfo) {
  const nome = coluna.nome.toLowerCase();

  // Oculta campos que representam códigos/identificadores.
  // (pedido: não exibir códigos nas tabelas)
  const isCodigo =
    nome === "id" ||
    nome.includes("codigo") ||
    nome.includes("cod") ||
    nome.endsWith("_id") ||
    nome.includes("_id") ||
    nome.startsWith("id_") ||
    nome.includes("uuid");

  const isFlags =
    nome.includes("flas") || nome.includes("flag") || nome.includes("flags");

  if (isCodigo || isFlags) return true;
  return false;
}

export function TabelaGenerica({
  colunas,
  resposta,
  carregando,
  pagina,
  onPaginaChange,
  ordenarPor,
  ordem,
  onOrdenarPorChange,
}: TabelaGenericaProps) {
  const [linhaSelecionada, setLinhaSelecionada] = useState<LinhaDetalhe | null>(
    null,
  );

  const colunasVisiveis = useMemo(
    () => colunas.filter((c) => !deveOcultarColuna(c)),
    [colunas],
  );

  const columnDefs = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      colunasVisiveis.map((coluna) => ({
        accessorKey: coluna.nome,
        header: coluna.nome,
        cell: (info) => {
          const textoCompleto = formatarValorParaExibicao(info.getValue());
          const { texto } = truncarTextoParaExibicao(
            textoCompleto,
            LIMITE_CARACTERES,
          );

          return (
            <span title={textoCompleto} className="block">
              {texto}
            </span>
          );
        },
      })),
    [colunasVisiveis],
  );

  const table = useReactTable({
    data: resposta?.dados ?? [],
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Container de scroll com padding lateral para não “grudar” na borda */}
      <div className="min-h-0 flex-1 overflow-auto px-4 sm:px-6">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="hover:bg-transparent">
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const nomeColuna = header.column.id;
                return (
                  <TableHead
                    key={header.id}
                    className="cabecalho-coluna cursor-pointer select-none whitespace-nowrap py-3"
                    onClick={() => onOrdenarPorChange(nomeColuna)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {ordenarPor === nomeColuna ? (
                        <span className="text-primary">
                          {ordem === "asc" ? "↑" : "↓"}
                        </span>
                      ) : (
                        <ArrowUpDown className="h-3 w-3 opacity-30" />
                      )}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {carregando &&
              Array.from({ length: 12 }).map((_, i) => (
                <TableRow key={i}>
                  {colunasVisiveis.map((coluna) => (
                    <TableCell key={coluna.nome}>
                      <Skeleton className="h-4 w-full max-w-[140px]" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!carregando && table.getRowModel().rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={colunasVisiveis.length || 1}
                  className="py-16 text-center text-muted-foreground"
                >
                  Nenhum registro encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            )}

            {!carregando &&
              table.getRowModel().rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    setLinhaSelecionada({
                      index: idx,
                      dados: row.original as Record<string, unknown>,
                    })
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    return (
                      <TableCell
                        key={cell.id}
                        className="whitespace-nowrap py-2.5"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Rodapé: contagem de linhas + paginação */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-4 py-3 sm:px-6">
        <Badge variant="outline" className="dado-tabular text-primary">
          {resposta ? `${resposta.totalLinhas} registros` : "—"}
        </Badge>

        <div className="flex items-center gap-3">
          <span className="cabecalho-coluna">
            Página {resposta?.pagina ?? pagina} de{" "}
            {resposta?.totalPaginas ?? "—"}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={pagina <= 1}
              onClick={() => onPaginaChange(pagina - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={!!resposta && pagina >= resposta.totalPaginas}
              onClick={() => onPaginaChange(pagina + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Popup com todas as infos da linha (somente colunas visíveis) */}
      <Sheet
        open={!!linhaSelecionada}
        onOpenChange={(open) => {
          if (!open) setLinhaSelecionada(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Detalhes do registro</SheetTitle>
            <SheetDescription>
              {linhaSelecionada ? `Linha ${linhaSelecionada.index + 1}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3 overflow-auto pr-1">
            {linhaSelecionada &&
              colunasVisiveis.map((coluna) => {
                const valorCompleto = formatarValorParaExibicao(
                  linhaSelecionada.dados[coluna.nome],
                );

                return (
                  <div key={coluna.nome}>
                    <div className="text-xs font-medium text-muted-foreground">
                      {coluna.nome}
                    </div>
                    <div className="mt-1 break-words text-sm">
                      {valorCompleto}
                    </div>
                  </div>
                );
              })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
