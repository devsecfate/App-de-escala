import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { motion } from "motion/react";
import { CalendarDays, CalendarOff, House, LogOut, UserCog, Users } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AvisoOffline } from "./AvisoOffline";
import { cx } from "../lib/cx";
import { usaMovimentoReduzido } from "../lib/movimento";

/**
 * Casca do app.
 *
 * O layout antigo era um header de dashboard: quatro links de texto numa linha
 * só, sem `flex-wrap`, dentro de um `max-w-4xl` — num iPhone SE os links
 * estouravam para fora da tela. Agora são duas navegações:
 *
 * - celular: barra fixa embaixo, ícone + rótulo, alvo de toque cheio, somando
 *   a safe-area para não ficar embaixo do home indicator do iPhone;
 * - `sm:` para cima: a barra volta para o topo, junto do nome da igreja.
 *
 * O indicador de aba ativa é o mesmo elemento nas duas (`layoutId`), então ele
 * desliza de uma aba para a outra em vez de piscar.
 */

const ABAS = [
  { para: "/", rotulo: "Início", Icone: House, exato: true },
  { para: "/ministerios", rotulo: "Ministérios", Icone: Users, exato: false },
  { para: "/eventos", rotulo: "Eventos", Icone: CalendarDays, exato: false },
  { para: "/disponibilidade", rotulo: "Ausências", Icone: CalendarOff, exato: false },
];

/** A aba de "Pessoas" é da igreja inteira, então só quem administra a vê. */
const ABA_PESSOAS = { para: "/pessoas", rotulo: "Pessoas", Icone: UserCog, exato: false };

/** "Ana Paula" → "AP"; e-mail sem nome → a primeira letra. */
function iniciais(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0]!.slice(0, 1).toUpperCase();
  return (partes[0]!.slice(0, 1) + partes[partes.length - 1]!.slice(0, 1)).toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { session, perfil, sair } = useAuth();
  const abas = perfil?.papelGlobal === "admin" ? [...ABAS, ABA_PESSOAS] : ABAS;
  const semMovimento = usaMovimentoReduzido();
  const transicaoIndicador = semMovimento
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 32 };

  return (
    <div className="min-h-dvh bg-fundo">
      {/* Vidro: o conteúdo passa por baixo ao rolar em vez de sumir num corte. */}
      <div className="sticky top-0 z-30 border-b border-borda/70 bg-superficie/80 backdrop-blur-xl">
        <AvisoOffline />

        <header className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pt-[calc(0.75rem+var(--area-segura-superior))] pb-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-6">
            <NavLink to="/" className="flex shrink-0 items-center gap-2" viewTransition>
              <img src="/pwa-icon.svg" alt="" aria-hidden className="size-8 rounded-lg" />
              <span className="text-base font-bold tracking-tight text-texto sm:hidden">Escala</span>
            </NavLink>

            {/* Navegação de desktop. No celular quem manda é a barra de baixo. */}
            <nav aria-label="Seções" className="hidden items-center gap-1 sm:flex">
              {abas.map(({ para, rotulo, exato }) => (
                <NavLink
                  key={para}
                  to={para}
                  end={exato}
                  viewTransition
                  className={({ isActive }) =>
                    cx(
                      "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-(--duracao-rapida)",
                      isActive ? "text-marca-800" : "text-texto-suave hover:text-texto",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="indicador-aba-desktop"
                          transition={transicaoIndicador}
                          className="absolute inset-0 -z-10 rounded-lg bg-marca-50"
                        />
                      )}
                      {rotulo}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {/* O nome vira a porta da conta: era só um texto cinza, e não havia
                nenhuma tela para corrigir o próprio nome ou o fuso da igreja. */}
            <NavLink
              to="/conta"
              viewTransition
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-2 rounded-full px-2 py-1.5 transition duration-(--duracao-rapida) hover:bg-superficie-suave",
                  isActive && "bg-superficie-suave",
                )
              }
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca-50 text-sm font-bold text-marca-800">
                {iniciais(perfil?.nome ?? session?.user.email ?? "?")}
              </span>
              <span className="hidden max-w-40 truncate text-sm font-medium text-texto md:inline">
                {perfil?.nome ?? session?.user.email}
              </span>
              <span className="sr-only">Minha conta</span>
            </NavLink>

            <button
              type="button"
              onClick={() => void sair()}
              className="flex size-11 items-center justify-center rounded-full text-texto-suave transition hover:bg-superficie-suave hover:text-texto sm:size-auto sm:gap-1.5 sm:px-3 sm:py-2"
            >
              <LogOut aria-hidden className="size-5 sm:size-4" />
              <span className="sr-only text-sm font-medium sm:not-sr-only">Sair</span>
            </button>
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-4xl px-4 pt-6 pb-[calc(var(--altura-barra-inferior)+var(--area-segura-inferior)+1.5rem)] sm:px-6 sm:pb-12">
        {children}
      </main>

      {/* Barra inferior do celular. `pb` soma a safe-area para os rótulos não
          ficarem embaixo do home indicator do iPhone. */}
      <nav
        aria-label="Seções"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-borda/70 bg-superficie/90 pb-[var(--area-segura-inferior)] backdrop-blur-xl sm:hidden"
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {abas.map(({ para, rotulo, Icone, exato }) => (
            <li key={para} className="flex-1">
              <NavLink
                to={para}
                end={exato}
                viewTransition
                className={({ isActive }) =>
                  cx(
                    "relative flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors duration-(--duracao-rapida)",
                    isActive ? "text-marca-700" : "text-texto-suave",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="indicador-aba-celular"
                        transition={transicaoIndicador}
                        className="absolute inset-x-3 top-0 h-0.5 rounded-full bg-marca-600"
                      />
                    )}
                    <Icone aria-hidden className={cx("size-5", isActive && "scale-110")} />
                    {rotulo}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
