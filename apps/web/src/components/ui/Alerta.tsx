import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cx } from "../../lib/cx";

export type TipoAlerta = "erro" | "sucesso" | "aviso" | "info";

const ESTILOS: Record<TipoAlerta, { classe: string; Icone: typeof Info }> = {
  erro: { classe: "border-perigo/30 bg-perigo-suave text-perigo-forte", Icone: XCircle },
  sucesso: { classe: "border-sucesso/30 bg-sucesso-suave text-sucesso-forte", Icone: CheckCircle2 },
  aviso: { classe: "border-atencao/30 bg-atencao-suave text-atencao-forte", Icone: AlertTriangle },
  info: { classe: "border-marca-200 bg-marca-50 text-marca-800", Icone: Info },
};

/**
 * Substitui as 15 cópias de `<p className="text-sm text-red-600">`, que além
 * de divergirem na margem não eram anunciadas por leitor de tela: sem
 * `role="alert"`, quem não está olhando para o campo nunca fica sabendo que o
 * envio falhou.
 */
export function Alerta({
  tipo = "erro",
  titulo,
  className,
  children,
}: {
  tipo?: TipoAlerta;
  titulo?: string;
  className?: string;
  children: ReactNode;
}) {
  const { classe, Icone } = ESTILOS[tipo];

  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cx("flex items-start gap-2.5 rounded-xl border p-3 text-sm", classe, className)}
    >
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div className={cx(titulo && "mt-0.5")}>{children}</div>
      </div>
    </div>
  );
}
