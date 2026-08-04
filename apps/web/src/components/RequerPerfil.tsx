import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { TelaCarregando } from "./TelaCarregando";

/**
 * Exige sessão E perfil (igreja já criada, ou convite já usado).
 * Quem está logado mas ainda não tem perfil vai para /onboarding.
 */
export function RequerPerfil({ children }: { children: ReactNode }) {
  const { session, perfil, carregando } = useAuth();
  const localizacao = useLocation();

  if (carregando) {
    return <TelaCarregando />;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ de: localizacao }} />;
  }

  if (!perfil) {
    return <Navigate to="/onboarding" replace state={{ de: localizacao }} />;
  }

  return <>{children}</>;
}
