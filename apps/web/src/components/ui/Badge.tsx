import type { ReactNode } from "react";
import { Check, Clock, X } from "lucide-react";
import { cx } from "../../lib/cx";
import type { StatusConfirmacao } from "@escala-app/core";

export type TomBadge = "neutro" | "marca" | "sucesso" | "atencao" | "perigo";

const TONS: Record<TomBadge, string> = {
  neutro: "bg-superficie-suave text-texto-suave",
  marca: "bg-marca-50 text-marca-800",
  sucesso: "bg-sucesso-suave text-sucesso-forte",
  atencao: "bg-atencao-suave text-atencao-forte",
  perigo: "bg-perigo-suave text-perigo-forte",
};

export function Badge({
  tom = "neutro",
  icone,
  className,
  children,
}: {
  tom?: TomBadge;
  icone?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        TONS[tom],
        className,
      )}
    >
      {icone}
      {children}
    </span>
  );
}

/**
 * O rótulo de confirmação, em um lugar só.
 *
 * Home.tsx e MontarEscala.tsx tinham cada um a sua `rotuloConfirmacao`, e os
 * textos já tinham divergido: "Não vou" numa tela, "Não vai" na outra, para o
 * mesmo estado. Aqui o ponto de vista é explícito.
 */
export function BadgeConfirmacao({
  confirmacao,
  pontoDeVista = "propria",
}: {
  confirmacao: StatusConfirmacao | string | null;
  /** "propria" = a pessoa vendo a própria escala; "lider" = o líder vendo a equipe. */
  pontoDeVista?: "propria" | "lider";
}) {
  if (!confirmacao) return null;

  if (confirmacao === "confirmado") {
    return (
      <Badge tom="sucesso" icone={<Check aria-hidden className="size-3.5" />}>
        Confirmado
      </Badge>
    );
  }

  if (confirmacao === "recusado") {
    return (
      <Badge tom="perigo" icone={<X aria-hidden className="size-3.5" />}>
        {pontoDeVista === "propria" ? "Não vou" : "Não vai"}
      </Badge>
    );
  }

  return (
    <Badge tom="atencao" icone={<Clock aria-hidden className="size-3.5" />}>
      {pontoDeVista === "propria" ? "Pendente" : "Aguardando"}
    </Badge>
  );
}
