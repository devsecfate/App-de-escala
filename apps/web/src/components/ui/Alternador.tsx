import { motion } from "motion/react";
import { useId } from "react";
import { cx } from "../../lib/cx";
import { MOLA_SUAVE, useTransicao } from "../../lib/movimento";

export interface OpcaoAlternador<T extends string> {
  valor: T;
  rotulo: string;
  /** Número ao lado do rótulo (ex: quantos itens arquivados existem). */
  contagem?: number;
}

/**
 * Alternador de duas ou três opções, com a pílula deslizando por baixo.
 *
 * Usado para "Ativos / Arquivados": arquivar só é honesto se existir um lugar
 * onde o item arquivado ainda pode ser encontrado e desarquivado. Sem isso,
 * "arquivar" é só "excluir" com outro nome.
 */
export function Alternador<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotulo,
  className,
}: {
  opcoes: OpcaoAlternador<T>[];
  valor: T;
  aoMudar: (novo: T) => void;
  /** Rótulo para leitor de tela (o grupo em si não tem título visível). */
  rotulo: string;
  className?: string;
}) {
  const idGrupo = useId();
  const transicao = useTransicao(MOLA_SUAVE);

  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className={cx(
        "inline-flex items-center gap-1 rounded-xl border border-borda bg-superficie-suave p-1",
        className,
      )}
    >
      {opcoes.map((opcao) => {
        const selecionada = opcao.valor === valor;
        return (
          <button
            key={opcao.valor}
            type="button"
            role="tab"
            aria-selected={selecionada}
            onClick={() => aoMudar(opcao.valor)}
            className={cx(
              "relative min-h-9 rounded-lg px-3 text-sm font-semibold transition duration-(--duracao-rapida)",
              selecionada ? "text-marca-contraste" : "text-texto-suave hover:text-texto",
            )}
          >
            {selecionada && (
              <motion.span
                layoutId={`${idGrupo}-pilula`}
                transition={transicao}
                className="absolute inset-0 rounded-lg bg-superficie shadow-cartao"
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {opcao.rotulo}
              {typeof opcao.contagem === "number" && opcao.contagem > 0 && (
                <span
                  className={cx(
                    "rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums",
                    selecionada ? "bg-marca-suave text-marca-contraste" : "bg-borda text-texto-suave",
                  )}
                >
                  {opcao.contagem}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
