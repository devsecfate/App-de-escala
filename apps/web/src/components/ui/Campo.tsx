import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "../../lib/cx";

/**
 * Campo de formulário com `<label>` sempre associado.
 *
 * Hoje 20 campos do app só têm `placeholder`: o leitor de tela anuncia "caixa
 * de edição" sem dizer do quê, e o rótulo some no instante em que a pessoa
 * começa a digitar. Aqui o rótulo é obrigatório — se ele não deve aparecer na
 * tela, use `rotuloOculto`, que mantém o rótulo para a acessibilidade.
 */
interface Comum {
  rotulo: string;
  rotuloOculto?: boolean;
  /** Texto de apoio abaixo do campo. */
  dica?: ReactNode;
  /** Mensagem de erro; substitui a dica e marca o campo como inválido. */
  erro?: string | null;
}

const CAMPO_BASE =
  "w-full min-h-11 rounded-xl border bg-superficie px-3 py-2 text-base text-texto " +
  "transition duration-(--duracao-rapida) placeholder:text-texto-suave/70 " +
  "focus:outline-none disabled:cursor-not-allowed disabled:bg-superficie-suave sm:text-sm";

const CAMPO_NORMAL = "border-borda focus:border-marca-600 focus:ring-4 focus:ring-marca-600/10";
const CAMPO_ERRO = "border-perigo focus:border-perigo focus:ring-4 focus:ring-perigo/10";

function Envolucro({
  id,
  rotulo,
  rotuloOculto,
  dica,
  erro,
  idAuxiliar,
  children,
  className,
}: Comum & { id: string; idAuxiliar: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("w-full", className)}>
      <label
        htmlFor={id}
        className={cx(
          "mb-1.5 block text-sm font-medium text-texto",
          rotuloOculto && "sr-only",
        )}
      >
        {rotulo}
      </label>
      {children}
      {erro ? (
        <p id={idAuxiliar} className="mt-1.5 text-sm font-medium text-perigo">
          {erro}
        </p>
      ) : dica ? (
        <p id={idAuxiliar} className="mt-1.5 text-sm text-texto-suave">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id">, Comum {
  /** Classe do contêiner (o `className` normal vai para o `<input>`). */
  classeContainer?: string;
  /** Botão colado à direita, dentro do campo (ex: mostrar/ocultar senha). */
  sufixo?: ReactNode;
}

export function Campo({
  rotulo,
  rotuloOculto,
  dica,
  erro,
  classeContainer,
  className,
  sufixo,
  ...resto
}: CampoProps) {
  const id = useId();
  const idAuxiliar = `${id}-auxiliar`;
  const temAuxiliar = Boolean(erro || dica);

  return (
    <Envolucro
      id={id}
      rotulo={rotulo}
      rotuloOculto={rotuloOculto}
      dica={dica}
      erro={erro}
      idAuxiliar={idAuxiliar}
      className={classeContainer}
    >
      <div className="relative">
        <input
          id={id}
          aria-invalid={erro ? true : undefined}
          aria-describedby={temAuxiliar ? idAuxiliar : undefined}
          className={cx(
            CAMPO_BASE,
            erro ? CAMPO_ERRO : CAMPO_NORMAL,
            sufixo ? "pr-12" : undefined,
            className,
          )}
          {...resto}
        />
        {sufixo && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{sufixo}</div>
        )}
      </div>
    </Envolucro>
  );
}

export interface CampoSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id">,
    Comum {
  classeContainer?: string;
}

export function CampoSelect({
  rotulo,
  rotuloOculto,
  dica,
  erro,
  classeContainer,
  className,
  children,
  ...resto
}: CampoSelectProps) {
  const id = useId();
  const idAuxiliar = `${id}-auxiliar`;
  const temAuxiliar = Boolean(erro || dica);

  return (
    <Envolucro
      id={id}
      rotulo={rotulo}
      rotuloOculto={rotuloOculto}
      dica={dica}
      erro={erro}
      idAuxiliar={idAuxiliar}
      className={classeContainer}
    >
      <select
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={temAuxiliar ? idAuxiliar : undefined}
        className={cx(CAMPO_BASE, erro ? CAMPO_ERRO : CAMPO_NORMAL, className)}
        {...resto}
      >
        {children}
      </select>
    </Envolucro>
  );
}

export interface CampoTextoLongoProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id">,
    Comum {
  classeContainer?: string;
}

export function CampoTextoLongo({
  rotulo,
  rotuloOculto,
  dica,
  erro,
  classeContainer,
  className,
  ...resto
}: CampoTextoLongoProps) {
  const id = useId();
  const idAuxiliar = `${id}-auxiliar`;
  const temAuxiliar = Boolean(erro || dica);

  return (
    <Envolucro
      id={id}
      rotulo={rotulo}
      rotuloOculto={rotuloOculto}
      dica={dica}
      erro={erro}
      idAuxiliar={idAuxiliar}
      className={classeContainer}
    >
      <textarea
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={temAuxiliar ? idAuxiliar : undefined}
        className={cx(CAMPO_BASE, "min-h-24 resize-y", erro ? CAMPO_ERRO : CAMPO_NORMAL, className)}
        {...resto}
      />
    </Envolucro>
  );
}
