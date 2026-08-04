import type { ReactNode } from "react";
import { motion } from "motion/react";
import { surgir, usaMovimentoReduzido } from "../lib/movimento";

/**
 * Casca das telas de entrada (Login, Cadastrar, Redefinir senha, Onboarding).
 *
 * É a primeira tela que a igreja inteira vai ver, e até agora era um card
 * branco sobre cinza sem nada que identificasse o app — o `pwa-icon.svg`
 * existia em `public/` e nunca aparecia dentro da UI. Aqui ele finalmente
 * aparece, sobre o gradiente da marca.
 */
export function AuthLayout({
  titulo,
  descricao,
  children,
  rodape,
}: {
  titulo: string;
  descricao?: ReactNode;
  children: ReactNode;
  /** Links secundários abaixo do card ("Já tem conta?", "Sair"). */
  rodape?: ReactNode;
}) {
  const semMovimento = usaMovimentoReduzido();

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-fundo px-4 py-10">
      {/* Brilho da marca atrás do card. `pointer-events-none` porque é só luz. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-marca-500/15 blur-3xl"
      />

      <motion.div
        variants={surgir}
        initial="oculto"
        animate="visivel"
        transition={semMovimento ? { duration: 0 } : undefined}
        className="relative w-full max-w-sm"
      >
        <div className="flex flex-col items-center text-center">
          <img
            src="/pwa-icon.svg"
            alt=""
            aria-hidden
            className="size-14 rounded-2xl shadow-flutuante"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-texto">{titulo}</h1>
          {descricao && <p className="mt-1.5 text-sm text-texto-suave">{descricao}</p>}
        </div>

        <div className="mt-6 rounded-2xl border border-borda bg-superficie p-6 shadow-flutuante">
          {children}
        </div>

        {rodape && <div className="mt-5 text-center text-sm text-texto-suave">{rodape}</div>}
      </motion.div>
    </div>
  );
}
