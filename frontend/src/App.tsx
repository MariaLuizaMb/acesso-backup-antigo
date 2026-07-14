import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RotaProtegida } from "@/lib/auth";
import LoginPage from "@/pages/LoginPage";
import TabelaPage from "@/pages/TabelaPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/tabelas"
            element={
              <RotaProtegida>
                <TabelaPage />
              </RotaProtegida>
            }
          />
          <Route
            path="/tabelas/:nome"
            element={
              <RotaProtegida>
                <TabelaPage />
              </RotaProtegida>
            }
          />
          <Route path="*" element={<Navigate to="/tabelas" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
