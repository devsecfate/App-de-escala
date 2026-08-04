import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Archive, ArchiveRestore, CalendarDays, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarEvento,
  contarEscalacoesDoEvento,
  criarEvento,
  definirEventoAtivo,
  listarMinisterios,
  listarMinisteriosLideradosPor,
  listarProximosEventos,
  removerEvento,
  type Evento,
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
  BotaoLink,
  Campo,
  CampoSelect,
  CampoTextoLongo,
  Card,
  ConfirmarAcao,
  EsqueletoLista,
  EstadoVazio,
  MenuAcoes,
  Modal,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { distanciaEmDias, formatarDataHora } from "../lib/formato";
import { mensagemDeErro } from "../lib/erros-auth";

type Aba = "proximos" | "arquivados";

const TIPOS = [
  { valor: "culto", rotulo: "Culto" },
  { valor: "ensaio", rotulo: "Ensaio" },
  { valor: "evento", rotulo: "Evento" },
];

function rotuloDoTipo(tipo: string): string {
  return TIPOS.find((item) => item.valor === tipo)?.rotulo ?? tipo;
}

/**
 * `<input type="datetime-local">` fala em hora local sem fuso ("2026-08-09T19:00")
 * e o banco guarda ISO com fuso. Estas duas funções fazem a ponte nos dois
 * sentidos — sem a volta, editar um evento abriria o campo vazio e a pessoa
 * teria que redigitar a data que só queria conferir.
 */
function paraCampoLocal(iso: string): string {
  const data = new Date(iso);
  const doisDigitos = (numero: number) => String(numero).padStart(2, "0");
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  );
}

export function Eventos() {
  const { perfil } = useAuth();

  const [eventos, setEventos] = useState<Evento[]>([]);
  const [ministeriosLiderados, setMinisteriosLiderados] = useState<
    { ministerioId: string; ministerioNome: string }[]
  >([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("proximos");

  const [formulario, setFormulario] = useState<{ alvo: Evento | null } | null>(null);
  const [exclusao, setExclusao] = useState<{ alvo: Evento; decisao: DecisaoDeExclusao } | null>(null);
  const [preparandoExclusao, setPreparandoExclusao] = useState<string | null>(null);

  const souAdmin = perfil?.papelGlobal === "admin";
  const podeGerenciar = souAdmin || ministeriosLiderados.length > 0;

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setErro(null);
    try {
      const [eventosCarregados, liderados] = await Promise.all([
        // Traz também os arquivados: quem gerencia tem a aba para desarquivar,
        // e para os demais o filtro logo abaixo os esconde de qualquer jeito.
        listarProximosEventos(supabase, perfil.igrejaId, true),
        listarMinisteriosLideradosPor(supabase, perfil.id),
      ]);
      setEventos(eventosCarregados);

      // O admin da igreja é líder de todo ministério para o banco (`e_lider()`
      // cai em `e_admin()`), mas não é membro de nenhum — então
      // `listarMinisteriosLideradosPor` devolvia vazio e ele ficava sem
      // nenhum caminho para montar escala. A tela agora reflete a permissão
      // que ele realmente tem.
      if (perfil.papelGlobal === "admin") {
        const todos = await listarMinisterios(supabase, perfil.igrejaId);
        setMinisteriosLiderados(
          todos.map((ministerio) => ({
            ministerioId: ministerio.id,
            ministerioNome: ministerio.nome,
          })),
        );
      } else {
        setMinisteriosLiderados(liderados);
      }
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar os eventos."));
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const proximos = useMemo(() => eventos.filter((evento) => evento.ativo), [eventos]);
  const arquivados = useMemo(() => eventos.filter((evento) => !evento.ativo), [eventos]);
  const visiveis = aba === "proximos" ? proximos : arquivados;

  async function prepararExclusao(alvo: Evento) {
    setPreparandoExclusao(alvo.id);
    setErro(null);
    try {
      const historico = await contarEscalacoesDoEvento(supabase, alvo.id);
      setExclusao({
        alvo,
        decisao: decidirExclusao({
          oQue: "o evento",
          nome: alvo.titulo,
          historico,
          unidadeHistorico: "escalações",
          // A policy `eventos_delete` é só para admin: um líder apagar um culto
          // levaria junto, em cascade, a escala de todos os outros ministérios.
          podeExcluirDeVez: souAdmin,
        }),
      });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível verificar as escalas deste evento."));
    } finally {
      setPreparandoExclusao(null);
    }
  }

  async function confirmarExclusao() {
    if (!exclusao) return;
    if (exclusao.decisao.arquivar) {
      await definirEventoAtivo(supabase, exclusao.alvo.id, false);
    } else {
      await removerEvento(supabase, exclusao.alvo.id);
    }
    await carregar();
  }

  async function desarquivar(alvo: Evento) {
    setErro(null);
    try {
      await definirEventoAtivo(supabase, alvo.id, true);
      await carregar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível desarquivar o evento."));
    }
  }

  return (
    <Layout>
      <TituloPagina
        descricao="Os cultos, ensaios e eventos que ainda vão acontecer."
        acoes={
          podeGerenciar && (
            <Botao icone={<Plus aria-hidden className="size-4" />} onClick={() => setFormulario({ alvo: null })}>
              Novo evento
            </Botao>
          )
        }
      >
        Agenda
      </TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      {podeGerenciar && arquivados.length > 0 && (
        <Alternador
          className="mt-5"
          rotulo="Mostrar eventos"
          valor={aba}
          aoMudar={setAba}
          opcoes={[
            { valor: "proximos", rotulo: "Próximos", contagem: proximos.length },
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
              descricao="Culto cancelado ou criado com a data errada fica guardado aqui."
            />
          ) : (
            <EstadoVazio
              icone={<CalendarDays aria-hidden className="size-6" />}
              titulo="Nenhum evento marcado"
              descricao={
                podeGerenciar
                  ? "Cadastre o próximo culto para começar a montar as escalas."
                  : "Assim que um líder marcar o próximo culto, ele aparece aqui."
              }
              acao={
                podeGerenciar && (
                  <Botao
                    icone={<Plus aria-hidden className="size-4" />}
                    onClick={() => setFormulario({ alvo: null })}
                  >
                    Marcar evento
                  </Botao>
                )
              }
            />
          )
        ) : (
          <motion.ul variants={listaEmCascata} initial="oculto" animate="visivel" className="space-y-3">
            <AnimatePresence initial={false}>
              {visiveis.map((evento) => (
                <motion.li
                  key={evento.id}
                  variants={itemDaLista}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  layout
                >
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tom="marca">{rotuloDoTipo(evento.tipo)}</Badge>
                          {evento.ativo ? (
                            <Badge tom="neutro">{distanciaEmDias(evento.dataHora)}</Badge>
                          ) : (
                            <Badge tom="atencao">Arquivado</Badge>
                          )}
                        </div>
                        <p className="mt-2 font-semibold text-texto">{evento.titulo}</p>
                        <p className="mt-0.5 text-sm text-texto-suave">{formatarDataHora(evento.dataHora)}</p>
                        {evento.observacoes && (
                          <p className="mt-1.5 text-sm text-texto-suave">{evento.observacoes}</p>
                        )}
                      </div>

                      {podeGerenciar && (
                        <MenuAcoes
                          rotulo={`Ações de ${evento.titulo}`}
                          acoes={
                            evento.ativo
                              ? [
                                  {
                                    rotulo: "Editar data e título",
                                    icone: <Pencil aria-hidden className="size-4" />,
                                    aoEscolher: () => setFormulario({ alvo: evento }),
                                  },
                                  {
                                    rotulo: "Arquivar ou excluir",
                                    icone: <Trash2 aria-hidden className="size-4" />,
                                    tom: "perigo",
                                    desabilitada: preparandoExclusao === evento.id,
                                    aoEscolher: () => void prepararExclusao(evento),
                                  },
                                ]
                              : [
                                  {
                                    rotulo: "Desarquivar",
                                    icone: <ArchiveRestore aria-hidden className="size-4" />,
                                    aoEscolher: () => void desarquivar(evento),
                                  },
                                ]
                          }
                        />
                      )}
                    </div>

                    {evento.ativo && ministeriosLiderados.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-borda pt-3">
                        {ministeriosLiderados.map((ministerio) => (
                          <BotaoLink
                            key={ministerio.ministerioId}
                            tamanho="pequeno"
                            icone={<ListChecks aria-hidden className="size-4" />}
                            to={`/eventos/${evento.id}/ministerios/${ministerio.ministerioId}/escala`}
                          >
                            {ministerio.ministerioNome}
                          </BotaoLink>
                        ))}
                      </div>
                    )}
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <FormularioEvento
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

function FormularioEvento({
  aberto,
  alvo,
  igrejaId,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  alvo: Evento | null;
  igrejaId: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [tipo, setTipo] = useState("culto");
  const [observacoes, setObservacoes] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setTitulo(alvo?.titulo ?? "");
    setDataHora(alvo ? paraCampoLocal(alvo.dataHora) : "");
    setTipo(alvo?.tipo ?? "culto");
    setObservacoes(alvo?.observacoes ?? "");
    setErro(null);
  }, [aberto, alvo]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!titulo.trim() || !dataHora) return;
    setSalvando(true);
    setErro(null);
    try {
      const iso = new Date(dataHora).toISOString();
      if (alvo) {
        await atualizarEvento(supabase, alvo.id, {
          titulo: titulo.trim(),
          dataHoraIso: iso,
          tipo,
          observacoes: observacoes.trim() || null,
        });
      } else {
        await criarEvento(supabase, igrejaId, titulo.trim(), iso, tipo, observacoes.trim() || undefined);
      }
      await aoSalvar();
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar o evento."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={alvo ? "Editar evento" : "Novo evento"}
      descricao={
        alvo
          ? "Quem já está escalado continua escalado; só a data e o título mudam para todo mundo."
          : undefined
      }
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <Campo
          rotulo="Título"
          value={titulo}
          onChange={(evento) => setTitulo(evento.target.value)}
          placeholder="Culto de domingo"
          autoFocus
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="Data e hora"
            type="datetime-local"
            value={dataHora}
            onChange={(evento) => setDataHora(evento.target.value)}
            required
          />
          <CampoSelect rotulo="Tipo" value={tipo} onChange={(evento) => setTipo(evento.target.value)}>
            {TIPOS.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.rotulo}
              </option>
            ))}
          </CampoSelect>
        </div>

        <CampoTextoLongo
          rotulo="Observações"
          dica="Opcional. Ex: chegar 30 minutos antes para a passagem de som."
          value={observacoes}
          onChange={(evento) => setObservacoes(evento.target.value)}
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!titulo.trim() || !dataHora}>
            {alvo ? "Salvar" : "Criar evento"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
