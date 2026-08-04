import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ExternalLink, Music, Pencil, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import {
  atualizarCampoMusica,
  atualizarCategoriaMusica,
  atualizarMusica,
  contarUsosDaMusica,
  criarCampoMusica,
  criarCategoriaMusica,
  criarMusica,
  definirMusicaAtiva,
  listarCamposMusica,
  listarCategoriasMusica,
  listarMembrosDoMinisterio,
  listarMusicas,
  obterMinisterio,
  removerCampoMusica,
  removerCategoriaMusica,
  removerMusica,
  type CampoMusica,
  type CategoriaMusica,
  type MembroMinisterioComPerfil,
  type Ministerio,
  type Musica,
  type MusicaInput,
  decidirExclusao,
  type DecisaoDeExclusao,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { ListaEditavel } from "../components/repertorio/ListaEditavel";
import {
  Alerta,
  Alternador,
  Badge,
  Botao,
  BotaoLink,
  Campo,
  CampoSelect,
  Card,
  ConfirmarAcao,
  EsqueletoLista,
  EstadoVazio,
  MenuAcoes,
  Modal,
  Secao,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { mensagemDeErro } from "../lib/erros-auth";

type Aba = "em-uso" | "antigas";

const FORMULARIO_VAZIO: MusicaInput = {
  titulo: "",
  artista: "",
  tom: "",
  andamento: "",
  categoria: "",
  link: "",
  extras: {},
};

export function Repertorio() {
  const { id: ministerioId } = useParams<{ id: string }>();
  const { perfil } = useAuth();

  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMusica[]>([]);
  const [campos, setCampos] = useState<CampoMusica[]>([]);
  const [membros, setMembros] = useState<MembroMinisterioComPerfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [aba, setAba] = useState<Aba>("em-uso");
  const [busca, setBusca] = useState("");
  const [formulario, setFormulario] = useState<{ alvo: Musica | null } | null>(null);
  const [exclusao, setExclusao] = useState<{ alvo: Musica; decisao: DecisaoDeExclusao } | null>(null);
  const [preparando, setPreparando] = useState<string | null>(null);

  const souLider = useMemo(() => {
    if (!perfil) return false;
    if (perfil.papelGlobal === "admin") return true;
    return membros.some((membro) => membro.perfilId === perfil.id && membro.papel === "lider");
  }, [perfil, membros]);

  const carregar = useCallback(async () => {
    if (!ministerioId) return;
    setErro(null);
    try {
      const [ministerioCarregado, musicasCarregadas, categoriasCarregadas, camposCarregados, membrosCarregados] =
        await Promise.all([
          obterMinisterio(supabase, ministerioId),
          // Sempre traz tudo: a aba filtra na tela, sem uma ida ao banco a cada
          // clique.
          listarMusicas(supabase, ministerioId, true),
          listarCategoriasMusica(supabase, ministerioId),
          listarCamposMusica(supabase, ministerioId),
          listarMembrosDoMinisterio(supabase, ministerioId),
        ]);
      setMinisterio(ministerioCarregado);
      setMusicas(musicasCarregadas);
      setCategorias(categoriasCarregadas);
      setCampos(camposCarregados);
      setMembros(membrosCarregados);
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar o repertório."));
    } finally {
      setCarregando(false);
    }
  }, [ministerioId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const emUso = musicas.filter((musica) => musica.ativa);
  const antigas = musicas.filter((musica) => !musica.ativa);

  const visiveis = useMemo(() => {
    const base = aba === "em-uso" ? emUso : antigas;
    const termo = busca.trim().toLowerCase();
    if (!termo) return base;
    return base.filter((musica) =>
      [musica.titulo, musica.artista, musica.tom, musica.categoria]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo)),
    );
  }, [aba, emUso, antigas, busca]);

  async function alternarAtiva(musica: Musica) {
    setErro(null);
    try {
      await definirMusicaAtiva(supabase, musica.id, !musica.ativa);
      await carregar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível atualizar a música."));
    }
  }

  async function prepararExclusao(alvo: Musica) {
    setPreparando(alvo.id);
    setErro(null);
    try {
      const historico = await contarUsosDaMusica(supabase, alvo.id);
      setExclusao({
        alvo,
        decisao: decidirExclusao({
          oQue: "a música",
          nome: alvo.titulo,
          historico,
          unidadeHistorico: "cronogramas",
        }),
      });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível verificar o histórico da música."));
    } finally {
      setPreparando(null);
    }
  }

  async function confirmarExclusao() {
    if (!exclusao) return;
    if (exclusao.decisao.arquivar) {
      await definirMusicaAtiva(supabase, exclusao.alvo.id, false);
    } else {
      await removerMusica(supabase, exclusao.alvo.id);
    }
    await carregar();
  }

  if (carregando) {
    return (
      <Layout>
        <EsqueletoLista linhas={4} />
      </Layout>
    );
  }

  if (!ministerio) {
    return (
      <Layout>
        <EstadoVazio
          titulo="Ministério não encontrado"
          descricao="Ele pode ter sido excluído, ou você não faz parte dele."
          acao={
            <BotaoLink to="/ministerios" icone={<ArrowLeft aria-hidden className="size-4" />}>
              Voltar para os ministérios
            </BotaoLink>
          }
        />
      </Layout>
    );
  }

  return (
    <Layout>
      <Link
        to={`/ministerios/${ministerio.id}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-texto-suave transition hover:text-texto"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {ministerio.nome}
      </Link>

      <TituloPagina
        descricao="As músicas que este ministério canta, com tom, categoria e link."
        acoes={
          souLider && (
            <Botao icone={<Plus aria-hidden className="size-4" />} onClick={() => setFormulario({ alvo: null })}>
              Nova música
            </Botao>
          )
        }
      >
        Repertório
      </TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      <div className="mt-5 flex flex-wrap items-end gap-3">
        <Campo
          rotulo="Buscar música"
          rotuloOculto
          classeContainer="flex-1 min-w-48"
          placeholder="Buscar por título, artista, tom..."
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
          sufixo={<Search aria-hidden className="mr-2 size-4 text-texto-suave" />}
        />
        {antigas.length > 0 && (
          <Alternador
            rotulo="Mostrar músicas"
            valor={aba}
            aoMudar={setAba}
            opcoes={[
              { valor: "em-uso", rotulo: "Em uso", contagem: emUso.length },
              { valor: "antigas", rotulo: "Antigas", contagem: antigas.length },
            ]}
          />
        )}
      </div>

      <div className="mt-5">
        {visiveis.length === 0 ? (
          <EstadoVazio
            icone={<Music aria-hidden className="size-6" />}
            titulo={
              busca.trim()
                ? "Nenhuma música com esse termo"
                : aba === "antigas"
                  ? "Nada no repertório antigo"
                  : "Repertório vazio"
            }
            descricao={
              busca.trim()
                ? "Tente outra palavra, ou limpe a busca."
                : souLider
                  ? "Cadastre as músicas que vocês cantam para montar o cronograma dos cultos."
                  : "O líder ainda não cadastrou músicas aqui."
            }
            acao={
              souLider &&
              !busca.trim() &&
              aba === "em-uso" && (
                <Botao
                  icone={<Plus aria-hidden className="size-4" />}
                  onClick={() => setFormulario({ alvo: null })}
                >
                  Adicionar música
                </Botao>
              )
            }
          />
        ) : (
          <motion.ul variants={listaEmCascata} initial="oculto" animate="visivel" className="space-y-3">
            <AnimatePresence initial={false}>
              {visiveis.map((musica) => {
                const detalhes = [musica.artista, musica.tom && `Tom ${musica.tom}`, musica.andamento]
                  .filter(Boolean)
                  .join(" · ");
                const extras = campos
                  .filter((campo) => musica.extras[campo.chave])
                  .map((campo) => `${campo.rotulo}: ${String(musica.extras[campo.chave])}`);

                return (
                  <motion.li
                    key={musica.id}
                    variants={itemDaLista}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    layout
                  >
                    <Card>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-texto">{musica.titulo}</p>
                            {musica.categoria && <Badge tom="marca">{musica.categoria}</Badge>}
                            {!musica.ativa && <Badge tom="neutro">Repertório antigo</Badge>}
                          </div>
                          {detalhes && <p className="mt-0.5 text-sm text-texto-suave">{detalhes}</p>}
                          {extras.length > 0 && (
                            <p className="mt-1 text-sm text-texto-suave">{extras.join(" · ")}</p>
                          )}
                          {musica.link && (
                            <a
                              href={musica.link}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-marca-700 underline underline-offset-2 hover:text-marca-800"
                            >
                              <ExternalLink aria-hidden className="size-3.5" />
                              Abrir link
                            </a>
                          )}
                        </div>

                        {souLider && (
                          <MenuAcoes
                            rotulo={`Ações de ${musica.titulo}`}
                            acoes={[
                              {
                                rotulo: "Editar",
                                icone: <Pencil aria-hidden className="size-4" />,
                                aoEscolher: () => setFormulario({ alvo: musica }),
                              },
                              {
                                rotulo: musica.ativa ? "Tirar de uso" : "Voltar a usar",
                                icone: <RotateCcw aria-hidden className="size-4" />,
                                aoEscolher: () => void alternarAtiva(musica),
                              },
                              {
                                rotulo: "Excluir",
                                icone: <Trash2 aria-hidden className="size-4" />,
                                tom: "perigo",
                                desabilitada: preparando === musica.id,
                                aoEscolher: () => void prepararExclusao(musica),
                              },
                            ]}
                          />
                        )}
                      </div>
                    </Card>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      {souLider && (
        <Secao
          titulo="Como o repertório é organizado"
          descricao="As categorias viram os momentos do culto no cronograma; as colunas são campos extras da ficha da música."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ListaEditavel
              titulo="Categorias"
              descricao="Abertura, Adoração, Ceia..."
              rotuloDoItem="categoria"
              placeholder="Nova categoria"
              itens={categorias.map((categoria) => ({ id: categoria.id, rotulo: categoria.nome }))}
              avisoDeExclusao="As músicas dessa categoria continuam no repertório, só ficam sem categoria."
              aoCriar={async (nome) => {
                if (!ministerioId) return;
                await criarCategoriaMusica(supabase, ministerioId, nome, categorias.length);
                await carregar();
              }}
              aoRenomear={async (id, nome) => {
                await atualizarCategoriaMusica(supabase, id, { nome });
                await carregar();
              }}
              aoExcluir={async (id) => {
                await removerCategoriaMusica(supabase, id);
                await carregar();
              }}
            />

            <ListaEditavel
              titulo="Colunas do repertório"
              descricao="Campos extras além dos fixos (ex: BPM, quem canta)."
              rotuloDoItem="coluna"
              placeholder="Nova coluna"
              itens={campos.map((campo) => ({ id: campo.id, rotulo: campo.rotulo }))}
              avisoDeExclusao="O que já foi digitado nessa coluna some das fichas. Renomear não apaga nada."
              aoCriar={async (rotulo) => {
                if (!ministerioId) return;
                await criarCampoMusica(supabase, ministerioId, rotulo, campos.length);
                await carregar();
              }}
              aoRenomear={async (id, rotulo) => {
                await atualizarCampoMusica(supabase, id, { rotulo });
                await carregar();
              }}
              aoExcluir={async (id) => {
                await removerCampoMusica(supabase, id);
                await carregar();
              }}
            />
          </div>
        </Secao>
      )}

      <FormularioMusica
        aberto={formulario !== null}
        alvo={formulario?.alvo ?? null}
        ministerioId={ministerioId ?? ""}
        categorias={categorias}
        campos={campos}
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

function FormularioMusica({
  aberto,
  alvo,
  ministerioId,
  categorias,
  campos,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  alvo: Musica | null;
  ministerioId: string;
  categorias: CategoriaMusica[];
  campos: CampoMusica[];
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [dados, setDados] = useState<MusicaInput>(FORMULARIO_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setDados(
      alvo
        ? {
            titulo: alvo.titulo,
            artista: alvo.artista ?? "",
            tom: alvo.tom ?? "",
            andamento: alvo.andamento ?? "",
            categoria: alvo.categoria ?? "",
            link: alvo.link ?? "",
            extras: alvo.extras,
          }
        : FORMULARIO_VAZIO,
    );
    setErro(null);
  }, [aberto, alvo]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!dados.titulo.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const entrada: MusicaInput = { ...dados, titulo: dados.titulo.trim() };
      if (alvo) {
        await atualizarMusica(supabase, alvo.id, entrada);
      } else {
        await criarMusica(supabase, ministerioId, entrada);
      }
      await aoSalvar();
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar a música."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={alvo ? "Editar música" : "Nova música"}
      larguraMaxima="max-w-lg"
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <Campo
          rotulo="Título"
          value={dados.titulo}
          onChange={(evento) => setDados({ ...dados, titulo: evento.target.value })}
          autoFocus
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Artista ou autor"
            value={dados.artista ?? ""}
            onChange={(evento) => setDados({ ...dados, artista: evento.target.value })}
          />
          <Campo
            rotulo="Tom"
            placeholder="G"
            value={dados.tom ?? ""}
            onChange={(evento) => setDados({ ...dados, tom: evento.target.value })}
          />
          <Campo
            rotulo="Andamento"
            placeholder="Lenta, moderada..."
            value={dados.andamento ?? ""}
            onChange={(evento) => setDados({ ...dados, andamento: evento.target.value })}
          />
          <CampoSelect
            rotulo="Categoria"
            value={dados.categoria ?? ""}
            onChange={(evento) => setDados({ ...dados, categoria: evento.target.value })}
          >
            <option value="">Sem categoria</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.nome}>
                {categoria.nome}
              </option>
            ))}
          </CampoSelect>
        </div>

        <Campo
          rotulo="Link"
          type="url"
          placeholder="https://youtube.com/..."
          dica="YouTube, cifra, playback — o que a equipe usa para ensaiar."
          value={dados.link ?? ""}
          onChange={(evento) => setDados({ ...dados, link: evento.target.value })}
        />

        {campos.length > 0 && (
          <div className="grid gap-4 border-t border-borda pt-4 sm:grid-cols-2">
            {campos.map((campo) => (
              <Campo
                key={campo.id}
                rotulo={campo.rotulo}
                value={String(dados.extras?.[campo.chave] ?? "")}
                onChange={(evento) =>
                  setDados({ ...dados, extras: { ...dados.extras, [campo.chave]: evento.target.value } })
                }
              />
            ))}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!dados.titulo.trim()}>
            {alvo ? "Salvar" : "Adicionar música"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
