import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cx } from "../../lib/cx";

export type VarianteBotao = "primario" | "secundario" | "perigo" | "fantasma";
export type TamanhoBotao = "medio" | "pequeno" | "grande";

/**
 * Altura mínima de 44px em todas as variantes: é o alvo de toque que a Apple e
 * a WCAG pedem, e os botões antigos tinham ~30px — errar o "Confirmar" no
 * celular era rotina.
 */
const BASE =
  "inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-xl px-4 " +
  "text-sm font-semibold whitespace-nowrap transition duration-(--duracao-rapida) " +
  "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55";

const VARIANTES: Record<VarianteBotao, string> = {
  // O glow é a sombra colorida do tema: some no repouso, cresce no hover.
  primario:
    "bg-marca-700 text-white shadow-cartao hover:bg-marca-600 hover:shadow-glow focus-visible:bg-marca-600",
  secundario:
    "border border-borda bg-superficie text-texto shadow-cartao hover:border-borda-forte hover:bg-superficie-suave",
  perigo: "bg-perigo text-white shadow-cartao hover:bg-perigo-forte",
  fantasma: "text-texto-suave hover:bg-superficie-suave hover:text-texto",
};

const TAMANHOS: Record<TamanhoBotao, string> = {
  pequeno: "min-h-11 px-3 text-sm",
  medio: "min-h-11 px-4 text-sm",
  grande: "min-h-12 w-full px-5 text-base",
};

interface PropriedadesComuns {
  variante?: VarianteBotao;
  tamanho?: TamanhoBotao;
  /** Ícone à esquerda do texto. Some enquanto `carregando`. */
  icone?: ReactNode;
  larguraTotal?: boolean;
}

export interface BotaoProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    PropriedadesComuns {
  /** Troca o ícone por um giro e desabilita o botão. */
  carregando?: boolean;
}

export function Botao({
  variante = "primario",
  tamanho = "medio",
  icone,
  carregando = false,
  larguraTotal = false,
  className,
  children,
  disabled,
  type = "button",
  ...resto
}: BotaoProps) {
  return (
    <button
      type={type}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cx(
        BASE,
        VARIANTES[variante],
        TAMANHOS[tamanho],
        larguraTotal && "w-full",
        className,
      )}
      {...resto}
    >
      {carregando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icone}
      {children}
    </button>
  );
}

export interface BotaoLinkProps extends LinkProps, PropriedadesComuns {}

/** Mesma aparência do `Botao`, mas navega (react-router). */
export function BotaoLink({
  variante = "secundario",
  tamanho = "medio",
  icone,
  larguraTotal = false,
  className,
  children,
  ...resto
}: BotaoLinkProps) {
  return (
    <Link
      className={cx(
        BASE,
        VARIANTES[variante],
        TAMANHOS[tamanho],
        larguraTotal && "w-full",
        className,
      )}
      {...resto}
    >
      {icone}
      {children}
    </Link>
  );
}
