import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ThemeContext } from "@/hooks/use-theme";
import type { Tema } from "@/hooks/use-theme";

function obterTemaInicial(): Tema {
  // O index.html já aplica a classe "dark" antes do React montar (evita flash),
  // então só precisamos ler o estado atual do DOM aqui.
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<Tema>(obterTemaInicial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    localStorage.setItem("tema", tema);
  }, [tema]);

  function alternarTema() {
    setTema((atual) => (atual === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ tema, alternarTema }}>
      {children}
    </ThemeContext.Provider>
  );
}
