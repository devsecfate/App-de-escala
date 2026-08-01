import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const linkBase = "rounded-lg px-3 py-1.5 text-sm font-medium";
const linkAtivo = "bg-slate-900 text-white";
const linkInativo = "text-slate-600 hover:bg-slate-100";

export function Layout({ children }: { children: ReactNode }) {
  const { session, perfil, sair } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkAtivo : linkInativo}`}>
              Início
            </NavLink>
            <NavLink
              to="/ministerios"
              className={({ isActive }) => `${linkBase} ${isActive ? linkAtivo : linkInativo}`}
            >
              Ministérios
            </NavLink>
            <NavLink to="/eventos" className={({ isActive }) => `${linkBase} ${isActive ? linkAtivo : linkInativo}`}>
              Eventos
            </NavLink>
          </nav>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {perfil?.nome ?? session?.user.email}
            </span>
            <button type="button" onClick={() => void sair()} className="text-sm text-slate-500 underline hover:text-slate-700">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
    </div>
  );
}
