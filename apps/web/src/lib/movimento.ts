/**
 * Movimento compartilhado: as molas e variantes que as telas reaproveitam,
 * mais o hook que respeita `prefers-reduced-motion`.
 *
 * O CSS já zera as durações de transição/animação para quem pediu menos
 * movimento (index.css), mas o `motion` anima em JS e não lê aquele bloco —
 * por isso o hook existe e as telas passam `duration: 0` quando ele diz.
 */

import { useEffect, useState } from "react";
import type { Transition, Variants } from "motion/react";

export const MOLA: Transition = { type: "spring", stiffness: 420, damping: 30, mass: 0.8 };
export const MOLA_SUAVE: Transition = { type: "spring", stiffness: 260, damping: 26 };
export const SAIDA: Transition = { duration: 0.24, ease: [0.22, 1, 0.36, 1] };

/** Entrada padrão de um bloco: sobe 6px e aparece. */
export const surgir: Variants = {
  oculto: { opacity: 0, y: 6 },
  visivel: { opacity: 1, y: 0, transition: SAIDA },
  saindo: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

/** Contêiner de lista: os filhos entram em cascata, um logo depois do outro. */
export const listaEmCascata: Variants = {
  oculto: {},
  visivel: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

export const itemDaLista: Variants = {
  oculto: { opacity: 0, y: 10 },
  visivel: { opacity: 1, y: 0, transition: SAIDA },
};

/** Modal: entra com mola, sai reto (sair com mola parece indeciso). */
export const modal: Variants = {
  oculto: { opacity: 0, scale: 0.96, y: 12 },
  visivel: { opacity: 1, scale: 1, y: 0, transition: MOLA },
  saindo: { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.12 } },
};

export const fundoDoModal: Variants = {
  oculto: { opacity: 0 },
  visivel: { opacity: 1, transition: { duration: 0.18 } },
  saindo: { opacity: 0, transition: { duration: 0.12 } },
};

/**
 * true quando o sistema pede menos movimento. Reage à troca em tempo real:
 * quem liga a opção no iOS com o app aberto vê o efeito na hora.
 */
export function usaMovimentoReduzido(): boolean {
  const [reduzido, setReduzido] = useState(() => consultaInicial());

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aoMudar = (evento: MediaQueryListEvent) => setReduzido(evento.matches);
    consulta.addEventListener("change", aoMudar);
    return () => consulta.removeEventListener("change", aoMudar);
  }, []);

  return reduzido;
}

function consultaInicial(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Transição pronta para usar em `motion`: vira instantânea quando o sistema
 * pede menos movimento.
 *
 *   const transicao = useTransicao(MOLA);
 */
export function useTransicao(transicao: Transition = SAIDA): Transition {
  return usaMovimentoReduzido() ? { duration: 0 } : transicao;
}
