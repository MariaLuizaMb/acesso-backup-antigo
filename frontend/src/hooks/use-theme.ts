import { createContext, useContext } from "react";

export type Tema = "light" | "dark";

export interface ThemeContextValue {
  tema: Tema;
  alternarTema: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export function useTheme() {
  const contexto = useContext(ThemeContext);
  if (!contexto)
    throw new Error("useTheme precisa estar dentro de um ThemeProvider");
  return contexto;
}
