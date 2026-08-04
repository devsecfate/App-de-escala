import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { TelaCarregando } from "./TelaCarregando";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, carregando } = useAuth();
  const localizacao = useLocation();

  if (carregando) {
    return <TelaCarregando />;
  }

  if (!session) {
    // Guardamos de onde a pessoa veio para o login devolver ela ao mesmo lugar.
    return <Navigate to="/login" replace state={{ de: localizacao }} />;
  }

  return <>{children}</>;
}
