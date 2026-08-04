import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarOff, Pencil, Plus, Trash2 } from "lucide-react";
import {
  atualizarIndisponibilidade,
  criarIndisponibilidade,
  listarIndisponibilidades,
  removerIndisponibilidade,
  type Indisponibilidade,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import {
  Alerta,
  Badge,
  Botao,
  Campo,
  Card,
  ConfirmarAcao,
  EsqueletoLista,
  EstadoVazio,
  MenuAcoes,
  Modal,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata } from "../lib/movimento";
import { mensagemDeErro } from "../lib/erros-auth";

/** As datas aqui são `date` puro (sem hora); o `T00:00:00` evita o pulo de fuso. */
function formatarDia(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function estaEmVigor(periodo: Indisponibilidade): boolean {
  const agora = hoje();
  if (periodo.dataInicio > agora) return false;
  return periodo.dataFim === null || periodo.dataFim >= agora;
}

export function Disponibilidade() {
  const { perfil } = useAuth();

  const [periodos, setPeriodos] = useState<Indisponibilidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<{ alvo: Indisponibilidade | null } | null>(null);
  const [exclusao, setExclusao] = useState<Indisponibilidade | null>(null);

  const carregar = useCallback(async () => {
    if (!perfil) return;
    setErro(null);
    try {
      setPeriodos(await listarIndisponibilidades(supabase, perfil.id));
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível carregar sua disponibilidade."));
    } finally {
      setCarregando(false);
    }
  }, [perfil]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function confirmarExclusao() {
    if (!exclusao) return;
    await removerIndisponibilidade(supabase, exclusao.id);
    await carregar();
  }

  return (
    <Layout>
      <TituloPagina
        descricao="Marque os períodos em que você não pode servir. Os líderes dos seus ministérios veem isso ao montar a escala."
        acoes={
          <Botao icone={<Plus aria-hidden className="size-4" />} onClick={() => setFormulario({ alvo: null })}>
            Novo período
          </Botao>
        }
      >
        Minha disponibilidade
      </TituloPagina>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      <div className="mt-5">
        {carregando ? (
          <EsqueletoLista linhas={2} />
        ) : periodos.length === 0 ? (
          <EstadoVazio
            icone={<CalendarOff aria-hidden className="size-6" />}
            titulo="Você está disponível"
            descricao="Nenhum período cadastrado. Viagem, trabalho ou qualquer motivo — avise aqui e os líderes já veem ao montar a escala."
            acao={
              <Botao icone={<Plus aria-hidden className="size-4" />} onClick={() => setFormulario({ alvo: null })}>
                Marcar um período
              </Botao>
            }
          />
        ) : (
          <motion.ul variants={listaEmCascata} initial="oculto" animate="visivel" className="space-y-3">
            <AnimatePresence initial={false}>
              {periodos.map((periodo) => (
                <motion.li
                  key={periodo.id}
                  variants={itemDaLista}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  layout
                >
                  <Card>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-texto">
                            {formatarDia(periodo.dataInicio)}
                            {periodo.dataFim ? ` até ${formatarDia(periodo.dataFim)}` : " em diante"}
                          </p>
                          {estaEmVigor(periodo) && <Badge tom="atencao">Em vigor</Badge>}
                        </div>
                        {periodo.motivo ? (
                          <p className="mt-1 text-sm text-texto-suave">{periodo.motivo}</p>
                        ) : (
                          <p className="mt-1 text-sm text-texto-suave">Sem motivo informado</p>
                        )}
                      </div>

                      <MenuAcoes
                        rotulo="Ações do período"
                        acoes={[
                          {
                            rotulo: "Editar datas",
                            icone: <Pencil aria-hidden className="size-4" />,
                            aoEscolher: () => setFormulario({ alvo: periodo }),
                          },
                          {
                            rotulo: "Excluir",
                            icone: <Trash2 aria-hidden className="size-4" />,
                            tom: "perigo",
                            aoEscolher: () => setExclusao(periodo),
                          },
                        ]}
                      />
                    </div>
                  </Card>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </div>

      <FormularioPeriodo
        aberto={formulario !== null}
        alvo={formulario?.alvo ?? null}
        perfilId={perfil?.id ?? ""}
        aoFechar={() => setFormulario(null)}
        aoSalvar={carregar}
      />

      <ConfirmarAcao
        aberto={exclusao !== null}
        aoFechar={() => setExclusao(null)}
        titulo="Excluir este período?"
        descricao="Você volta a aparecer como disponível para os líderes montarem a escala. Nada mais muda."
        rotuloConfirmar="Excluir"
        aoConfirmar={confirmarExclusao}
      />
    </Layout>
  );
}

function FormularioPeriodo({
  aberto,
  alvo,
  perfilId,
  aoFechar,
  aoSalvar,
}: {
  aberto: boolean;
  alvo: Indisponibilidade | null;
  perfilId: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<void>;
}) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [semDataFim, setSemDataFim] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    setDataInicio(alvo?.dataInicio ?? "");
    setDataFim(alvo?.dataFim ?? "");
    setSemDataFim(alvo ? alvo.dataFim === null : false);
    setMotivo(alvo?.motivo ?? "");
    setErro(null);
  }, [aberto, alvo]);

  const fimInvalido = !semDataFim && dataFim !== "" && dataInicio !== "" && dataFim < dataInicio;

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!dataInicio || fimInvalido) return;
    setSalvando(true);
    setErro(null);
    const fim = semDataFim ? null : dataFim || dataInicio;
    try {
      if (alvo) {
        await atualizarIndisponibilidade(supabase, alvo.id, {
          dataInicio,
          dataFim: fim,
          motivo: motivo.trim() || null,
        });
      } else {
        await criarIndisponibilidade(supabase, perfilId, dataInicio, fim, motivo.trim() || undefined);
      }
      await aoSalvar();
      aoFechar();
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível salvar o período."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={aoFechar}
      titulo={alvo ? "Editar período" : "Novo período"}
      descricao="Isto não cancela escala que já existe — avise o líder se você já estava escalado."
    >
      <form onSubmit={salvar} className="space-y-4">
        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            rotulo="A partir de"
            type="date"
            value={dataInicio}
            onChange={(evento) => setDataInicio(evento.target.value)}
            required
          />
          <Campo
            rotulo="Até"
            type="date"
            value={semDataFim ? "" : dataFim}
            min={dataInicio || undefined}
            disabled={semDataFim}
            erro={fimInvalido ? "A data final não pode ser antes da inicial." : null}
            onChange={(evento) => setDataFim(evento.target.value)}
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-texto">
          <input
            type="checkbox"
            checked={semDataFim}
            onChange={(evento) => setSemDataFim(evento.target.checked)}
            className="size-4 rounded border-borda-forte text-marca-700 focus:ring-marca-600"
          />
          Sem data para voltar
        </label>

        <Campo
          rotulo="Motivo"
          dica="Opcional, mas ajuda o líder a entender."
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          placeholder="Viagem de férias"
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <Botao variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Botao>
          <Botao type="submit" carregando={salvando} disabled={!dataInicio || fimInvalido}>
            {alvo ? "Salvar" : "Adicionar"}
          </Botao>
        </div>
      </form>
    </Modal>
  );
}
