import { useNavigate, useParams } from "react-router-dom";
import { useTabelas } from "@/hooks/useTabelas";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { data: tabelas, isLoading } = useTabelas();
  const { nome: tabelaAtual } = useParams();
  const navigate = useNavigate();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
          Consulta de Dados
        </span>
        <span className="cabecalho-coluna mt-1 block">
          {tabelas ? `${tabelas.length} tabelas com dados` : "carregando..."}
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="cabecalho-coluna">
            Tabelas
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <Skeleton className="mx-2 my-1 h-7 rounded-md" />
                  </SidebarMenuItem>
                ))}

              {tabelas?.map((tabela) => (
                <SidebarMenuItem key={tabela.nome}>
                  <SidebarMenuButton
                    isActive={tabela.nome === tabelaAtual}
                    onClick={() => navigate(`/tabelas/${tabela.nome}`)}
                    className="justify-between"
                  >
                    <span className="truncate">{tabela.nome}</span>
                    <Badge
                      variant="outline"
                      className="dado-tabular shrink-0 text-[10px] text-muted-foreground"
                    >
                      {tabela.quantidadeLinhas}
                    </Badge>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
