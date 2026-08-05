import type { ReactNode } from "react";
import { cx } from "../../lib/cx";

/**
 * A mensagem de "ainda não há nada aqui".
 *
 * Havia 10 delas espalhadas, com redação e margem diferentes, e três eram um
 * `<li>` dentro da própria `<ul>` — ou seja, o leitor de tela anunciava "lista
 * com 1 item" onde não havia item nenhum. Aqui é sempre um bloco fora da lista.
 *
 * `acao` é o que faz a diferença: tela vazia sem saída deixa a pessoa parada.
 */
export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone?: ReactNode;
  titulo: string;
  descricao?: ReactNode;
  acao?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center rounded-cartao border border-dashed border-borda-forte " +
          "bg-superficie/60 px-6 py-10 text-center",
        className,
      )}
    >
      {icone && (
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-marca-suave text-marca-contraste">
          {icone}
        </div>
      )}
      <p className="font-semibold text-texto">{titulo}</p>
      {descricao && <p className="mt-1 max-w-sm text-sm text-texto-suave">{descricao}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
