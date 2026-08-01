import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Exige sessão E perfil (igreja já criada / pessoa já convidada).
 * Quem está logado mas ainda não tem perfil vai para /onboarding.
 */
export function RequerPerfil({ children }: { children: ReactNode }) {
  const { session, perfil, carregando } = useAuth();

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (!perfil) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
