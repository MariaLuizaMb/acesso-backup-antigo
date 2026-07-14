import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api";

interface AuthContextValue {
  usuario: string | null;
  autenticado: boolean;
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<string | null>(() =>
    localStorage.getItem("usuario"),
  );

  async function login(usuarioDigitado: string, senha: string) {
    const { data } = await api.post("api/login", {
      usuario: usuarioDigitado,
      senha,
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("usuario", usuarioDigitado);
    setUsuario(usuarioDigitado);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{ usuario, autenticado: !!usuario, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto)
    throw new Error("useAuth precisa estar dentro de um AuthProvider");
  return contexto;
}

export function RotaProtegida({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  if (!autenticado) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
