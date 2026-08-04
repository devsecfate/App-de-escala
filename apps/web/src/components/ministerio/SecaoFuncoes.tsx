import { useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArchiveRestore, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarFuncao,
  contarEscalacoesDaFuncao,
  criarFuncao,
  definirFuncaoAtiva,
  removerFuncao,
  type Funcao,
  decidirExclusao,
  type DecisaoDeExclusao,
} from "@escala-app/core";
import { supabase } from "../../lib/supabase";
import {
  Alerta,
  Alternador,
  Badge,
  Botao,
  Campo,
  ConfirmarAcao,
  EstadoVazio,
  MenuAcoes,
  Modal,
  Secao,
} from "../ui";
import { itemDaLista, listaEmCascata } from "../../lib/movimento";
import { mensagemDeErro } from "../../lib/erros-auth";

type Aba = "ativas" | "arquivadas";

/**
 * As funções do ministério (Vocal, Guitarra, Projeção…).
 *
 * Antes eram chips estáticos: dava para criar e nunca mais mexer — errou o
 * nome, era para sempre, e a função errada continuava aparecendo em toda escala
 * montada dali em diante.
 */
export function SecaoFuncoes({
  funcoes,
  souLider,
  aoMudar,
  ministerioId,
}: {
  funcoes: Funcao[];
  souLider: boolean;
  ministerioId: string;
  aoMudar: () => Promise<void>;
}) {
  const [aba, setAba] = useState<Aba>("ativas");
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<{ alvo: Funcao | null } | null>(null);
  const [exclusao, setExclusao] = useState<{ alvo: Funcao; decisao: DecisaoDeExclusao } | null>(null);
  const [preparando, setPreparando] = useState<string | null>(null);

  const ativas = funcoes.filter((funcao) => funcao.ativo);
  const arquivadas = funcoes.filter((funcao) => !funcao.ativo);
  const visiveis = aba === "ativas" ? ativas : arquivadas;

  async function prepararExclusao(alvo: Funcao) {
    setPreparando(alvo.id);
    setErro(null);
    try {
      const historico = await contarEscalacoesDaFuncao(supabase, alvo.id);
      setExclusao({
        alvo,
        decisao: decidirExclusao({
          oQue: "a função",
          nome: alvo.nome,
          historico,
          unidadeHistorico: "escalações",
        }),
      });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível verificar o histórico da função."));
    } finally {
      setPreparando(null);
    }
  }

  async function confirmarExclusao() {
    if (!exclusao) return;
    if (exclusao.decisao.arquivar) {
      await definirFuncaoAtiva(supabase, exclusao.alvo.id, false);
    } else {
      await removerFuncao(supabase, exclusao.alvo.id);
    }
    await aoMudar();
  }

  async function desarquivar(alvo: Funcao) {
    setErro(null);
    try {
      await definirFuncaoAtiva(supabase, alvo.id, true);
      await aoMudar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível desarquivar a função."));
    }
  }

  return (
    <Secao
      titulo="Funções"
      descricao="Os postos que precisam ser preenchidos em cada escala deste ministério."
      acoes={
        souLider && (
          <Botao
            tamanho="pequeno"
            icone={<Plus aria-hidden className="size-4" />}
            onClick={() => setFormulario({ alvo: null })}
          >
            Nova função
          </Botao>
        )
      }
    >
      {erro && (
        <Alerta className="mb-3" tipo="erro">
          {erro}
        </Alerta>
      )}

      {souLider && arquivadas.length > 0 && (
        <Alternador
          className="mb-3"
          rotulo="Mostrar funções"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "ativas", rotulo: "Em uso", contagem: ativas.length },
            { valor: "arquivadas", rotulo: "Arquivadas", contagem: arquivadas.length },
          ]}
        />
      )}

      {visiveis.length === 0 ? (
        <EstadoVazio
          icone={<ListChecks aria-hidden className="size-6" />}
          titulo={aba === "arquivadas" ? "Nada arquivado" : "Nenhuma função ainda"}
          descricao={
            aba === "arquivadas"
              ? "Funções arquivadas ficam aqui e podem voltar quando você quiser."
              : souLider
                ? "Sem função cadastrada não dá para montar escala. Comece pelas mais óbvias: Vocal, Teclado, Som."
                : "O líder ainda não cadastrou as funções deste ministério."
          }
          acao={
            souLider &&
            aba === "ativas" && (
              <Botao
                icone={<Plus aria-hidden className="size-4" />}
                onClick={() => setFormulario({ alvo: null })}
              >
                Criar função
              </Botao>
            )
          }
        />
      ) : (
        <motion.ul
          variants={listaEmCascata}
          initial="oculto"
          animate="visivel"
          className="divide-y divide-borda overflow-hidden rounded-cartao border border-borda bg-superficie shadow-cartao"
        >
          <AnimatePresence initial={false}>
            {visiveis.map((funcao) => (
              <motion.li
                key={funcao.id}
                variants={itemDaLista}
                exit={{ opacity: 0, height: 0 }}
                layout
                className="flex items-center justify-between gap-2 py-1 pl-4 pr-2"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2 py-2">
                  <span className="font-medium text-texto">{funcao.nome}</span>
                  {funcao.obrigatoria && <Badge tom="atencao">Obrigatória</Badge>}
                  {!funcao.ativo && <Badge tom="neutro">Arquivada</Badge>}
                </div>

                {souLider && (
                  <MenuAcoes
                    rotulo={`Ações da função ${funcao.nome}`}
                    acoes={
                      funcao.ativo
                        ? [
                            {
                              rotulo: "Editar",
                              icone: <Pencil aria-hidden className="size-4" />,
                              aoEscolher: () => setFormulario({ alvo: funcao }),
                            },
                            {
                              rotulo: "Arquivar ou excluir",
                              icone: <Trash2 aria-hidden className="size-4" />,
                              tom: "perigo",
                              desabilitada: preparando === funcao.id,
                              aoEscolher: () => void prepararExclusao(funcao),
                            },
                          ]
                        : [
                            {
                              rotulo: "Desarquivar",
                              icone: <ArchiveRestore aria-hidden className="size-4" />,
                              aoEscolher: () => void desarquivar(funcao),
                            },
                          ]
                    }
                  />
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <FormularioFuncao
        aberto={formulario !== null}
        alvo={formulario?.alvo ?? null}
        ministerioId={ministerioId}
        aoFechar={() => setFormulario(null)}
        aoSalvar={aoMudar}
      />

      <ConfirmarAcao
        aberto={exclusao !== null}
        aoFechar={() => setExclusao(null)}
        titulo={exclusao?.decisao.titulo ?? ""}
        descricao={exclusao?.decisao.descricao}
        rotuloConfirmar={exclusao?.decisao.rotuloConfirmar ?? "Confirmar"}
        aoConfirmar={confirmarExclusao}
      />
    </Secao>
  );
}

function FormularioFuncao({
  aberto,
  alvo,
  ministerioId,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  alvo: Funcao | null;
  ministerioId: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [obrigatoria, setObrigatoria] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(alvo?.nome ?? "");
    setObrigatoria(alvo?.obrigatoria ?? false);
    setErro(null);
  }, [aberto, alvo]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      if (alvo) {
        await atualizarFuncao(supabase, alvo.id, { nome: nome.trim(), obrigatoria });
      } else {
        await criarFuncao(supabase, ministerioId, nome.trim(), obrigatoria);
      }
      await aoSalvar();
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar a função."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={alvo ? "Editar função" : "Nova função"}
      descricao={
        alvo
          ? "O nome novo passa a valer também nas escalas antigas — é a mesma função, só escrita certa."
          : undefined
      }
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <Campo
          rotulo="Nome da função"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          placeholder="Vocal"
          autoFocus
          required
        />

        <label className="flex items-start gap-2.5 text-sm text-texto">
          <input
            type="checkbox"
            checked={obrigatoria}
            onChange={(evento) => setObrigatoria(evento.target.checked)}
            className="mt-0.5 size-4 rounded border-borda-forte text-marca-700 focus:ring-marca-600"
          />
          <span>
            Obrigatória
            <span className="mt-0.5 block text-texto-suave">
              O app avisa ao publicar uma escala que deixou esta função vazia.
            </span>
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!nome.trim()}>
            {alvo ? "Salvar" : "Criar função"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
