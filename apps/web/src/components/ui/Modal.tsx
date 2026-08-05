import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { cx } from "../../lib/cx";
import { fundoDoModal, modal as variantesModal, usaMovimentoReduzido } from "../../lib/movimento";
import { Botao } from "./Botao";
import { Alerta } from "./Alerta";

/**
 * Não existia nada disso no app: nenhum botão destrutivo pedia confirmação, e
 * "Remover membro" apagava na hora, sem volta.
 *
 * No celular o modal entra como folha subindo do rodapé (o polegar alcança os
 * botões); no desktop, centralizado. Fecha com Esc, com clique fora e com o X.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  rodape,
  larguraMaxima = "max-w-md",
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  children?: ReactNode;
  rodape?: ReactNode;
  larguraMaxima?: string;
}) {
  const idTitulo = useId();
  const idDescricao = useId();
  const painelRef = useRef<HTMLDivElement>(null);
  const focoAnterior = useRef<HTMLElement | null>(null);
  const semMovimento = usaMovimentoReduzido();

  useEffect(() => {
    if (!aberto) return;

    focoAnterior.current = document.activeElement as HTMLElement | null;
    // O corpo não pode rolar por trás do modal — no iOS isso é o que faz a
    // página "escapar" enquanto a folha está aberta.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        aoFechar();
        return;
      }
      if (evento.key !== "Tab" || !painelRef.current) return;

      // Prende o Tab dentro do modal: sem isto o foco vai para os links da
      // página de trás, que o leitor de tela lê como se estivessem acessíveis.
      const focaveis = painelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (!primeiro || !ultimo) return;

      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    };

    document.addEventListener("keydown", aoTeclar, true);
    return () => {
      document.removeEventListener("keydown", aoTeclar, true);
      document.body.style.overflow = overflowAnterior;
      focoAnterior.current?.focus?.();
    };
  }, [aberto, aoFechar]);

  return createPortal(
    <AnimatePresence>
      {aberto && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            variants={fundoDoModal}
            initial="oculto"
            animate="visivel"
            exit="saindo"
            onClick={aoFechar}
            className="absolute inset-0 bg-veu backdrop-blur-[2px]"
          />

          <motion.div
            ref={painelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={idTitulo}
            aria-describedby={descricao ? idDescricao : undefined}
            variants={variantesModal}
            initial="oculto"
            animate="visivel"
            exit="saindo"
            transition={semMovimento ? { duration: 0 } : undefined}
            onAnimationComplete={() => painelRef.current?.focus()}
            tabIndex={-1}
            className={cx(
              "relative w-full rounded-t-2xl bg-superficie p-5 shadow-modal outline-none",
              "pb-[calc(1.25rem+var(--area-segura-inferior))] sm:rounded-2xl sm:pb-5",
              larguraMaxima,
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 id={idTitulo} className="text-lg font-semibold text-texto">
                  {titulo}
                </h2>
                {descricao && (
                  <div id={idDescricao} className="mt-1.5 text-sm text-texto-suave">
                    {descricao}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={aoFechar}
                aria-label="Fechar"
                className="-m-1.5 flex size-11 shrink-0 items-center justify-center rounded-full text-texto-suave transition hover:bg-superficie-suave hover:text-texto"
              >
                <X aria-hidden className="size-5" />
              </button>
            </div>

            {children && <div className="mt-4">{children}</div>}
            {rodape && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{rodape}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Confirmação de ação destrutiva.
 *
 * A `descricao` é o lugar de dizer *o que exatamente vai acontecer* — se o
 * item vai ser arquivado ou apagado de vez, e o que acontece com o histórico.
 * A regra do projeto é arquivar o que já foi usado; a tela que chama este
 * componente é quem conta o histórico e escreve a frase certa.
 */
export function ConfirmarAcao({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rotuloConfirmar = "Confirmar",
  rotuloCancelar = "Cancelar",
  variante = "perigo",
  aoConfirmar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: ReactNode;
  rotuloConfirmar?: string;
  rotuloCancelar?: string;
  variante?: "perigo" | "primario";
  aoConfirmar: () => void | Promise<void>;
}) {
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const fechar = useCallback(() => {
    if (processando) return;
    setErro(null);
    aoFechar();
  }, [processando, aoFechar]);

  async function confirmar() {
    setErro(null);
    setProcessando(true);
    try {
      await aoConfirmar();
      aoFechar();
    } catch (problema) {
      // O erro fica no próprio modal: fechar e mostrar o aviso na tela de trás
      // faz a pessoa achar que deu certo.
      setErro(problema instanceof Error ? problema.message : "Não foi possível concluir.");
    } finally {
      setProcessando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={titulo}
      descricao={descricao}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar} disabled={processando}>
            {rotuloCancelar}
          </Botao>
          <Botao variante={variante} onClick={() => void confirmar()} carregando={processando}>
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      {erro && <Alerta tipo="erro">{erro}</Alerta>}
    </Modal>
  );
}
