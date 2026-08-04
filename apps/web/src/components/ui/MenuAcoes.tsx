import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MoreVertical } from "lucide-react";
import { cx } from "../../lib/cx";
import { useTransicao } from "../../lib/movimento";

export interface AcaoDoMenu {
  rotulo: string;
  icone?: ReactNode;
  aoEscolher: () => void;
  /** "perigo" pinta de vermelho e separa do resto por uma linha. */
  tom?: "normal" | "perigo";
  desabilitada?: boolean;
  /** Aparece abaixo do rótulo, em cinza. Bom para explicar por que está desabilitada. */
  detalhe?: string;
}

/**
 * O "⋯" que abre editar / arquivar / excluir num item de lista.
 *
 * Existe porque cada cartão precisa de três ações e três botões lado a lado
 * estouram a largura de um iPhone SE. Escondê-las atrás de um menu mantém o
 * cartão legível sem esconder o poder de corrigir — que é justamente o que
 * faltava no app.
 *
 * Não é um `<select>` disfarçado: cada item é um `<button>` de verdade dentro
 * de um `role="menu"`, então o leitor de tela anuncia "menu" e o Esc fecha.
 */
export function MenuAcoes({
  acoes,
  rotulo = "Ações",
  className,
}: {
  acoes: AcaoDoMenu[];
  rotulo?: string;
  className?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const idMenu = useId();
  const transicao = useTransicao();

  useEffect(() => {
    if (!aberto) return;

    const aoClicarFora = (evento: MouseEvent) => {
      if (!containerRef.current?.contains(evento.target as Node)) setAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberto(false);
    };

    document.addEventListener("mousedown", aoClicarFora);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  if (acoes.length === 0) return null;

  return (
    <div ref={containerRef} className={cx("relative", className)}>
      <button
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idMenu : undefined}
        onClick={() => setAberto((estava) => !estava)}
        className={cx(
          "flex size-11 items-center justify-center rounded-xl text-texto-suave",
          "transition duration-(--duracao-rapida) hover:bg-superficie-suave hover:text-texto",
          aberto && "bg-superficie-suave text-texto",
        )}
      >
        <MoreVertical aria-hidden className="size-5" />
      </button>

      <AnimatePresence>
        {aberto && (
          <motion.div
            id={idMenu}
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -2 }}
            transition={transicao}
            className={cx(
              "absolute right-0 top-full z-30 mt-1 w-56 origin-top-right overflow-hidden",
              "rounded-xl border border-borda bg-superficie p-1 shadow-flutuante",
            )}
          >
            {acoes.map((acao, indice) => (
              <button
                key={acao.rotulo}
                type="button"
                role="menuitem"
                disabled={acao.desabilitada}
                onClick={() => {
                  setAberto(false);
                  acao.aoEscolher();
                }}
                className={cx(
                  "flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium",
                  "transition duration-(--duracao-rapida) disabled:cursor-not-allowed disabled:opacity-50",
                  acao.tom === "perigo"
                    ? "text-perigo hover:bg-perigo-suave"
                    : "text-texto hover:bg-superficie-suave",
                  // Separa o destrutivo do resto: clicar por engano custa caro.
                  acao.tom === "perigo" && indice > 0 && "mt-1 border-t border-borda pt-2.5",
                )}
              >
                {acao.icone && <span className="mt-0.5 shrink-0">{acao.icone}</span>}
                <span className="min-w-0">
                  {acao.rotulo}
                  {acao.detalhe && (
                    <span className="mt-0.5 block text-xs font-normal text-texto-suave">
                      {acao.detalhe}
                    </span>
                  )}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
