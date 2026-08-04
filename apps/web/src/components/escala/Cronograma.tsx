import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, ChevronUp, Music, Plus, Trash2 } from "lucide-react";
import {
  adicionarItemCronograma,
  atualizarItemCronograma,
  moverItem,
  proximaOrdem,
  removerItemCronograma,
  salvarOrdemCronograma,
  type CategoriaMusica,
  type ItemCronograma,
  type Musica,
} from "@escala-app/core";
import { supabase } from "../../lib/supabase";
import { Alerta, Botao, Campo, CampoSelect, EstadoVazio, Secao } from "../ui";
import { itemDaLista, listaEmCascata } from "../../lib/movimento";
import { mensagemDeErro } from "../../lib/erros-auth";

/**
 * As músicas do culto, em ordem. Só aparece para ministério que mantém
 * repertório — não faz sentido pedir cronograma à equipe de recepção.
 */
export function Cronograma({
  escalaId,
  itens,
  repertorio,
  categorias,
  aoMudar,
  definirItens,
}: {
  escalaId: string;
  itens: ItemCronograma[];
  repertorio: Musica[];
  categorias: CategoriaMusica[];
  aoMudar: () => Promise<void>;
  /** Aplica a nova ordem na tela antes de o banco confirmar. */
  definirItens: (itens: ItemCronograma[]) => void;
}) {
  const [musicaEscolhida, setMusicaEscolhida] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function adicionar() {
    if (!musicaEscolhida) return;
    setAdicionando(true);
    setErro(null);
    try {
      await adicionarItemCronograma(supabase, escalaId, {
        musicaId: musicaEscolhida,
        ordem: proximaOrdem(itens),
      });
      setMusicaEscolhida("");
      await aoMudar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível adicionar a música."));
    } finally {
      setAdicionando(false);
    }
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= itens.length) return;

    const reordenado = moverItem(itens, indice, destino);
    definirItens(reordenado);
    setErro(null);
    try {
      await salvarOrdemCronograma(
        supabase,
        reordenado.map((item) => item.id),
      );
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível reordenar o cronograma."));
      await aoMudar();
    }
  }

  async function atualizar(itemId: string, campos: { tomDoDia?: string | null; momento?: string | null }) {
    setErro(null);
    try {
      await atualizarItemCronograma(supabase, itemId, campos);
      await aoMudar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar a música."));
    }
  }

  async function remover(itemId: string) {
    setErro(null);
    try {
      await removerItemCronograma(supabase, itemId);
      await aoMudar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível tirar a música do cronograma."));
    }
  }

  return (
    <Secao titulo="Cronograma do culto" descricao="A ordem das músicas, o tom do dia e o momento de cada uma.">
      {erro && (
        <Alerta className="mb-3" tipo="erro">
          {erro}
        </Alerta>
      )}

      {itens.length === 0 ? (
        <EstadoVazio
          icone={<Music aria-hidden className="size-6" />}
          titulo="Nenhuma música ainda"
          descricao="Escolha do repertório abaixo para montar a ordem do culto."
        />
      ) : (
        <motion.ol
          variants={listaEmCascata}
          initial="oculto"
          animate="visivel"
          className="space-y-3"
        >
          <AnimatePresence initial={false}>
            {itens.map((item, indice) => (
              <motion.li
                key={item.id}
                variants={itemDaLista}
                exit={{ opacity: 0, height: 0 }}
                layout
                className="rounded-cartao border border-borda bg-superficie p-4 shadow-cartao"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-sm font-bold text-marca-800">
                    {indice + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-texto">{item.musicaTitulo}</p>
                    {item.musicaTom && (
                      <p className="text-sm text-texto-suave">Tom original: {item.musicaTom}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void mover(indice, -1)}
                      disabled={indice === 0}
                      aria-label={`Subir ${item.musicaTitulo}`}
                      className="flex size-11 items-center justify-center rounded-xl text-texto-suave transition hover:bg-superficie-suave hover:text-texto disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronUp aria-hidden className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void mover(indice, 1)}
                      disabled={indice === itens.length - 1}
                      aria-label={`Descer ${item.musicaTitulo}`}
                      className="flex size-11 items-center justify-center rounded-xl text-texto-suave transition hover:bg-superficie-suave hover:text-texto disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ChevronDown aria-hidden className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remover(item.id)}
                      aria-label={`Tirar ${item.musicaTitulo} do cronograma`}
                      className="flex size-11 items-center justify-center rounded-xl text-texto-suave transition hover:bg-perigo-suave hover:text-perigo"
                    >
                      <Trash2 aria-hidden className="size-5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Campo
                    rotulo="Tom do dia"
                    placeholder={item.musicaTom ?? "Ex: G"}
                    defaultValue={item.tomDoDia ?? ""}
                    onBlur={(evento) => {
                      const valor = evento.target.value.trim();
                      if (valor !== (item.tomDoDia ?? "")) {
                        void atualizar(item.id, { tomDoDia: valor || null });
                      }
                    }}
                  />
                  <CampoSelect
                    rotulo="Momento do culto"
                    value={item.momento ?? ""}
                    onChange={(evento) => void atualizar(item.id, { momento: evento.target.value || null })}
                  >
                    <option value="">Não definido</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.nome}>
                        {categoria.nome}
                      </option>
                    ))}
                  </CampoSelect>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ol>
      )}

      {repertorio.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <CampoSelect
            rotulo="Adicionar do repertório"
            classeContainer="sm:flex-1"
            value={musicaEscolhida}
            onChange={(evento) => setMusicaEscolhida(evento.target.value)}
          >
            <option value="">Escolha uma música...</option>
            {repertorio.map((musica) => (
              <option key={musica.id} value={musica.id}>
                {musica.titulo}
                {musica.tom ? ` (${musica.tom})` : ""}
              </option>
            ))}
          </CampoSelect>
          <Botao
            icone={<Plus aria-hidden className="size-4" />}
            carregando={adicionando}
            disabled={!musicaEscolhida}
            onClick={() => void adicionar()}
          >
            Adicionar
          </Botao>
        </div>
      )}
    </Secao>
  );
}
