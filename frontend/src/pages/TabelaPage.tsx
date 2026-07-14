import { useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useColunasTabela } from "@/hooks/useColunasTabela";
import { useDadosTabela } from "@/hooks/useDadosTabela";
import { AppSidebar } from "@/components/AppSidebar";
import { FiltrosTabela } from "@/components/FiltrosTabela";
import { TabelaGenerica } from "@/components/TabelaGenerica";
import { ThemeToggle } from "@/components/themeToggle";
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const LINHAS_POR_PAGINA = 25;

export default function TabelaPage() {
  const { nome } = useParams<{ nome: string }>();
  const { usuario, logout } = useAuth();

  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [colunaFiltro, setColunaFiltro] = useState<string | null>(null);
  const [valorFiltro, setValorFiltro] = useState("");
  const [ordenarPor, setOrdenarPor] = useState<string | undefined>(undefined);
  const [ordem, setOrdem] = useState<"asc" | "desc">("asc");

  const { data: colunas, isLoading: carregandoColunas } =
    useColunasTabela(nome);

  const { data: resposta, isFetching: carregandoDados } = useDadosTabela(nome, {
    pagina,
    porPagina: LINHAS_POR_PAGINA,
    busca: busca || undefined,
    ordenarPor,
    ordem,
    filtros:
      colunaFiltro && valorFiltro ? { [colunaFiltro]: valorFiltro } : undefined,
  });

  function alternarOrdenacao(coluna: string) {
    if (ordenarPor === coluna) {
      setOrdem(ordem === "asc" ? "desc" : "asc");
    } else {
      setOrdenarPor(coluna);
      setOrdem("asc");
    }
    setPagina(1);
  }

  function atualizarPagina(novaPagina: number) {
    setPagina(Math.max(1, novaPagina));
  }

  function atualizarBusca(valor: string) {
    setBusca(valor);
    setPagina(1);
  }

  function atualizarColunaFiltro(coluna: string | null) {
    setColunaFiltro(coluna);
    setValorFiltro("");
    setPagina(1);
  }

  function atualizarValorFiltro(valor: string) {
    setValorFiltro(valor);
    setPagina(1);
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      {/* h-screen + overflow-hidden aqui é o que impede a página inteira de rolar:
          só o conteúdo interno da tabela (mais abaixo) tem scroll próprio. */}
      <SidebarInset className="flex h-screen min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-border bg-background px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="shrink-0 text-muted-foreground" />
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {nome ?? "Selecione uma tabela"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {usuario}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        {!nome && (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Selecione uma tabela no menu lateral para começar.
          </div>
        )}

        {nome && carregandoColunas && (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            Carregando estrutura da tabela...
          </div>
        )}

        {nome && colunas && (
          <>
            <FiltrosTabela
              colunas={colunas}
              busca={busca}
              onBuscaChange={atualizarBusca}
              colunaFiltro={colunaFiltro}
              onColunaFiltroChange={atualizarColunaFiltro}
              valorFiltro={valorFiltro}
              onValorFiltroChange={atualizarValorFiltro}
            />
            <TabelaGenerica
              colunas={colunas}
              resposta={resposta}
              carregando={carregandoDados}
              pagina={pagina}
              onPaginaChange={atualizarPagina}
              ordenarPor={ordenarPor}
              ordem={ordem}
              onOrdenarPorChange={alternarOrdenacao}
            />
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
