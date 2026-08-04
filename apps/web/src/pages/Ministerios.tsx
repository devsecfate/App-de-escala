import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, ChevronRight, Pencil, Plus, Trash2, Users } from "lucide-react";
import {
  atualizarMinisterio,
  contarEscalacoesDoMinisterio,
  contarMembrosPorMinisterio,
  criarMinisterio,
  definirMinisterioAtivo,
  listarMinisterios,
  removerMinisterio,
  type Ministerio,
  decidirExclusao,
  type DecisaoDeExclusao,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import {
  Alerta,
  Alternador,
  Badge,
  Botao,
  Campo,
  CampoTextoLongo,
  Card,
  ConfirmarAcao,
  EstadoVazio,
  EsqueletoLista,
  MenuAcoes,
  Modal,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { mensagemDeErro } from "../lib/erros-auth";

type Aba = "ativos" | "arquivados";

export function Ministerios() {
  const { perfil } = useAuth();
  const souAdmin = perfil?.papelGlobal === "admin";

  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [membrosPorMinisterio, setMembrosPorMinisterio] = useState<Map<string, number>>(new Map());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("ativos");

  const [formulario, setFormulario] = useState<{ alvo: Ministerio | null } | null>(null);
  const [exclusao, setExclusao] = useState<{ alvo: Ministerio; decisao: DecisaoDeExclusao } | null>(null);
  const [preparandoExclusao, setPreparandoExclusao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setErro(null);
    try {
      // Admin vê arquivados também (é quem pode desarquivar); os demais nem
      // sabem que a aba existe, então não vale gastar a consulta maior.
      const lista = await listarMinisterios(supabase, perfil.igrejaId, souAdmin);
      setMinisterios(lista);
      setMembrosPorMinisterio(
        await contarMembrosPorMinisterio(
          supabase,
          lista.map((ministerio) => ministerio.id),
        ),
      );
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar os ministérios."));
    } finally {
      setCarregando(false);
    }
  }, [perfil, souAdmin]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const ativos = useMemo(() => ministerios.filter((m) => m.ativo), [ministerios]);
  const arquivados = useMemo(() => ministerios.filter((m) => !m.ativo), [ministerios]);
  const visiveis = aba === "ativos" ? ativos : arquivados;

  /**
   * Conta o histórico ANTES de abrir a confirmação: é o número que decide entre
   * "some de vez" e "vou arquivar", e a frase precisa dele para ser honesta.
   */
  async function prepararExclusao(alvo: Ministerio) {
    setPreparandoExclusao(alvo.id);
    setErro(null);
    try {
      const historico = await contarEscalacoesDoMinisterio(supabase, alvo.id);
      setExclusao({
        alvo,
        decisao: decidirExclusao({ oQue: "o ministério", nome: alvo.nome, historico }),
      });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível verificar o histórico do ministério."));
    } finally {
      setPreparandoExclusao(null);
    }
  }

  async function confirmarExclusao() {
    if (!exclusao) return;
    if (exclusao.decisao.arquivar) {
      await definirMinisterioAtivo(supabase, exclusao.alvo.id, false);
    } else {
      await removerMinisterio(supabase, exclusao.alvo.id);
    }
    await carregar();
  }

  async function desarquivar(alvo: Ministerio) {
    setErro(null);
    try {
      await definirMinisterioAtivo(supabase, alvo.id, true);
      await carregar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível desarquivar o ministério."));
    }
  }

  return (
    <Layout>
      <TituloPagina
        descricao="Cada ministério tem as próprias pessoas, funções e escalas."
        acoes={
          souAdmin && (
            <Botao icone={<Plus aria-hidden className="size-4" />} onClick={() => setFormulario({ alvo: null })}>
              Novo ministério
            </Botao>
          )
        }
      >
        Ministérios
      </TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      {souAdmin && arquivados.length > 0 && (
        <Alternador
          className="mt-5"
          rotulo="Mostrar ministérios"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "ativos", rotulo: "Ativos", contagem: ativos.length },
            { valor: "arquivados", rotulo: "Arquivados", contagem: arquivados.length },
          ]}
        />
      )}

      <div className="mt-5">
        {carregando ? (
          <EsqueletoLista linhas={3} />
        ) : visiveis.length === 0 ? (
          aba === "arquivados" ? (
            <EstadoVazio
              icone={<Archive aria-hidden className="size-6" />}
              titulo="Nada arquivado"
              descricao="Ministérios arquivados aparecem aqui e podem voltar quando você quiser."
            />
          ) : (
            <EstadoVazio
              icone={<Users aria-hidden className="size-6" />}
              titulo="Nenhum ministério ainda"
              descricao={
                souAdmin
                  ? "Comece criando um: Louvor, Recepção, Mídia — o nome que a sua igreja usa."
                  : "Assim que o administrador criar os ministérios, eles aparecem aqui."
              }
              acao={
                souAdmin && (
                  <Botao icone={<Plus aria-hidden className="size-4" />} onClick={() => setFormulario({ alvo: null })}>
                    Criar o primeiro
                  </Botao>
                )
              }
            />
          )
        ) : (
          <motion.ul
            variants={listaEmCascata}
            initial="oculto"
            animate="visivel"
            className="space-y-3"
          >
            <AnimatePresence initial={false}>
              {visiveis.map((ministerio) => {
                const pessoas = membrosPorMinisterio.get(ministerio.id) ?? 0;
                return (
                  <motion.li
                    key={ministerio.id}
                    variants={itemDaLista}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    layout
                  >
                    <Card interativo className="flex items-center gap-3">
                      <Link
                        to={`/ministerios/${ministerio.id}`}
                        className="-m-4 flex min-w-0 flex-1 items-center gap-3 rounded-cartao p-4"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-semibold text-texto">{ministerio.nome}</p>
                            {!ministerio.ativo && <Badge tom="neutro">Arquivado</Badge>}
                          </div>
                          {ministerio.descricao && (
                            <p className="mt-0.5 truncate text-sm text-texto-suave">{ministerio.descricao}</p>
                          )}
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-texto-suave">
                            <Users aria-hidden className="size-4" />
                            {pessoas === 0 ? "Ninguém ainda" : pessoas === 1 ? "1 pessoa" : `${pessoas} pessoas`}
                          </p>
                        </div>
                        <ChevronRight aria-hidden className="size-5 shrink-0 text-texto-suave" />
                      </Link>

                      {souAdmin && (
                        <MenuAcoes
                          rotulo={`Ações de ${ministerio.nome}`}
                          acoes={
                            ministerio.ativo
                              ? [
                                  {
                                    rotulo: "Editar nome",
                                    icone: <Pencil aria-hidden className="size-4" />,
                                    aoEscolher: () => setFormulario({ alvo: ministerio }),
                                  },
                                  {
                                    rotulo: "Arquivar ou excluir",
                                    icone: <Trash2 aria-hidden className="size-4" />,
                                    tom: "perigo",
                                    desabilitada: preparandoExclusao === ministerio.id,
                                    aoEscolher: () => void prepararExclusao(ministerio),
                                  },
                                ]
                              : [
                                  {
                                    rotulo: "Desarquivar",
                                    icone: <ArchiveRestore aria-hidden className="size-4" />,
                                    aoEscolher: () => void desarquivar(ministerio),
                                  },
                                ]
                          }
                        />
                      )}
                    </Card>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <FormularioMinisterio
        aberto={formulario !== null}
        alvo={formulario?.alvo ?? null}
        igrejaId={perfil?.igrejaId ?? ""}
        aoFechar={() => setFormulario(null)}
        aoSalvar={carregar}
      />

      <ConfirmarAcao
        aberto={exclusao !== null}
        aoFechar={() => setExclusao(null)}
        titulo={exclusao?.decisao.titulo ?? ""}
        descricao={exclusao?.decisao.descricao}
        rotuloConfirmar={exclusao?.decisao.rotuloConfirmar ?? "Confirmar"}
        aoConfirmar={confirmarExclusao}
      />
    </Layout>
  );
}

/** Mesmo formulário para criar e para corrigir — o que muda é o título. */
function FormularioMinisterio({
  aberto,
  alvo,
  igrejaId,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  alvo: Ministerio | null;
  igrejaId: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setNome(alvo?.nome ?? "");
    setDescricao(alvo?.descricao ?? "");
    setErro(null);
  }, [aberto, alvo]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      if (alvo) {
        await atualizarMinisterio(supabase, alvo.id, {
          nome: nome.trim(),
          descricao: descricao.trim() || null,
        });
      } else {
        await criarMinisterio(supabase, igrejaId, nome.trim(), descricao.trim() || undefined);
      }
      await aoSalvar();
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar o ministério."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={alvo ? "Editar ministério" : "Novo ministério"}
      descricao={alvo ? "O nome muda em todas as telas, inclusive nas escalas já publicadas." : undefined}
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          placeholder="Louvor"
          autoFocus
          required
        />

        <CampoTextoLongo
          rotulo="Descrição"
          dica="Opcional. Ajuda quem está entrando a saber do que se trata."
          value={descricao}
          onChange={(evento) => setDescricao(evento.target.value)}
          placeholder="Equipe de música dos cultos de domingo"
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!nome.trim()}>
            {alvo ? "Salvar" : "Criar ministério"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
