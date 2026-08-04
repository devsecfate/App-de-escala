import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../../lib/cx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Levanta no hover. Só para card que é clicável — senão engana. */
  interativo?: boolean;
  /** Fundo em gradiente da marca; reservado para o destaque da tela. */
  destaque?: boolean;
  children: ReactNode;
}

/**
 * O contêiner branco que estava copiado 21 vezes como
 * `rounded-xl border border-slate-200 bg-white p-4`.
 */
export function Card({ interativo = false, destaque = false, className, children, ...resto }: CardProps) {
  return (
    <div
      className={cx(
        "rounded-cartao border p-4 transition duration-(--duracao-rapida)",
        destaque
          ? "border-marca-600/40 bg-linear-to-br from-marca-700 to-marca-900 text-white shadow-flutuante"
          : "border-borda bg-superficie shadow-cartao",
        interativo &&
          (destaque
            ? "hover:shadow-glow"
            : "hover:-translate-y-0.5 hover:border-borda-forte hover:shadow-flutuante"),
        className,
      )}
      {...resto}
    >
      {children}
    </div>
  );
}

/** Cabeçalho do card: título à esquerda, ações à direita, sem estourar no celular. */
export function CardCabecalho({
  titulo,
  descricao,
  acoes,
  className,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-start justify-between gap-2", className)}>
      <div className="min-w-0">
        <p className="font-semibold text-current">{titulo}</p>
        {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
    </div>
  );
}
