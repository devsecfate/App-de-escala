import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * Hierarquia tipográfica.
 *
 * O app usava `text-sm` 156 vezes: o título da página e o parágrafo de apoio
 * tinham quase o mesmo peso, então nada guiava o olho. Aqui só existem três
 * degraus — título de página, título de seção e texto — e eles são bem
 * diferentes entre si de propósito.
 */
export function TituloPagina({
  children,
  descricao,
  acoes,
  className,
}: {
  children: ReactNode;
  descricao?: ReactNode;
  /** Botões da página (ex: "Novo evento"). Quebram para baixo no celular. */
  acoes?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-texto">{children}</h1>
        {descricao && <p className="mt-1 text-sm text-texto-suave">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  );
}

export function Secao({
  titulo,
  descricao,
  acoes,
  className,
  children,
}: {
  titulo: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={cx("mt-8 first:mt-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-texto">{titulo}</h2>
          {descricao && <p className="mt-0.5 text-sm text-texto-suave">{descricao}</p>}
        </div>
        {acoes && <div className="flex shrink-0 items-center gap-2">{acoes}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
