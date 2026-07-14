import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { tema, alternarTema } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternarTema}
      aria-label="Alternar tema claro/escuro"
      className="text-muted-foreground hover:text-foreground"
    >
      {tema === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
