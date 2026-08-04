import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, BarChart3, Lock } from "lucide-react";
import {
  listarMembrosDoMinisterio,
  mesDe,
  obterIgreja,
  obterMinisterio,
  obterRelatorioParticipacao,
  type Ministerio,
  type RelatorioParticipacao,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import {
  Alerta,
  Badge,
  BotaoLink,
  Campo,
  Card,
  EsqueletoLista,
  EstadoVazio,
  NumeroContando,
  TituloPagina,
} from "../components/ui";
import { itemDaLista, listaEmCascata, useTransicao } from "../lib/movimento";
import { mensagemDeErro } from "../lib/erros-auth";

function formatarDia(iso: string | null, fusoHorario: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    timeZone: fusoHorario,
  });
}

interface Periodo {
  inicio: string;
  fim: string;
}

const ATALHOS = [
  ["mes", "Este mês"],
  ["mesPassado", "Mês passado"],
  ["tresMeses", "Últimos 3 meses"],
  ["ano", "Este ano"],
] as const;

export function Relatorio() {
  const { id } = useParams<{ id: string }>();
  const { perfil } = useAuth();

  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [fusoHorario, setFusoHorario] = useState<string | null>(null);
  const [souLider, setSouLider] = useState(false);
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioParticipacao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Passo 1: ministério, fuso da igreja e permissão. O fuso decide qual é o
  // mês corrente que aparece nos campos de período.
  useEffect(() => {
    if (!id || !perfil) return;
    let cancelado = false;

    void (async () => {
      try {
        const [ministerioCarregado, igreja, membros] = await Promise.all([
          obterMinisterio(supabase, id),
          obterIgreja(supabase, perfil.igrejaId),
          listarMembrosDoMinisterio(supabase, id),
        ]);
        if (cancelado) return;

        const fuso = igreja?.fusoHorario ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        setMinisterio(ministerioCarregado);
        setFusoHorario(fuso);
        setSouLider(
          perfil.papelGlobal === "admin" ||
            membros.some((membro) => membro.perfilId === perfil.id && membro.papel === "lider"),
        );
        setPeriodo(mesDe(new Date(), fuso));
      } catch (problema) {
        if (!cancelado) {
          setErro(mensagemDeErro(problema, "Não foi possível abrir o relatório."));
          setCarregando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, perfil?.id]);

  // Passo 2: o relatório em si, recarregado a cada mudança de período.
  useEffect(() => {
    if (!id || !periodo || !fusoHorario) return;
    // Campo de data vazio ou invertido: avisa em vez de chamar a API com lixo.
    if (!periodo.inicio || !periodo.fim) {
      setErro("Escolha as duas datas do período.");
      return;
    }
    if (periodo.fim < periodo.inicio) {
      setErro("A data final é anterior à inicial.");
      return;
    }
    let cancelado = false;

    setCarregando(true);
    setErro(null);
    void obterRelatorioParticipacao(supabase, {
      ministerioId: id,
      dataInicio: periodo.inicio,
      dataFim: periodo.fim,
      fusoHorario,
    })
      .then((resultado) => {
        if (!cancelado) setRelatorio(resultado);
      })
      .catch((problema: unknown) => {
        if (!cancelado) setErro(mensagemDeErro(problema, "Não foi possível carregar o relatório."));
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [id, periodo, fusoHorario]);

  const maiorNumeroDeVezes = useMemo(
    () => relatorio?.linhas.reduce((maior, linha) => Math.max(maior, linha.vezes), 0) ?? 0,
    [relatorio],
  );

  function aplicarAtalho(atalho: (typeof ATALHOS)[number][0]) {
    if (!fusoHorario) return;
    const agora = new Date();
    const mesAtual = mesDe(agora, fusoHorario);

    if (atalho === "mes") setPeriodo(mesAtual);
    if (atalho === "mesPassado") setPeriodo(mesDe(agora, fusoHorario, -1));
    if (atalho === "tresMeses") {
      setPeriodo({ inicio: mesDe(agora, fusoHorario, -2).inicio, fim: mesAtual.fim });
    }
    if (atalho === "ano") {
      const ano = mesAtual.inicio.slice(0, 4);
      setPeriodo({ inicio: `${ano}-01-01`, fim: `${ano}-12-31` });
    }
  }

  if (!ministerio && carregando) {
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
          descricao={erro ?? "Ele pode ter sido excluído, ou você não faz parte dele."}
          acao={
            <BotaoLink to="/ministerios" icone={<ArrowLeft aria-hidden className="size-4" />}>
              Voltar para os ministérios
            </BotaoLink>
          }
        />
      </Layout>
    );
  }

  if (!souLider) {
    return (
      <Layout>
        <EstadoVazio
          icone={<Lock aria-hidden className="size-6" />}
          titulo="Relatório restrito"
          descricao={`O relatório de participação é do líder de ${ministerio.nome}.`}
          acao={
            <BotaoLink
              to={`/ministerios/${ministerio.id}`}
              icone={<ArrowLeft aria-hidden className="size-4" />}
            >
              Voltar ao ministério
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

      <TituloPagina descricao="Quantas vezes cada pessoa serviu no período — e quem ainda não serviu nenhuma.">
        Participação
      </TituloPagina>

      <Card className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            rotulo="De"
            type="date"
            value={periodo?.inicio ?? ""}
            onChange={(evento) =>
              setPeriodo((atual) => (atual ? { ...atual, inicio: evento.target.value } : atual))
            }
          />
          <Campo
            rotulo="Até"
            type="date"
            value={periodo?.fim ?? ""}
            onChange={(evento) =>
              setPeriodo((atual) => (atual ? { ...atual, fim: evento.target.value } : atual))
            }
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {ATALHOS.map(([atalho, texto]) => (
            <button
              key={atalho}
              type="button"
              onClick={() => aplicarAtalho(atalho)}
              className="min-h-9 rounded-lg border border-borda bg-superficie-suave px-3 text-sm font-medium text-texto-suave transition duration-(--duracao-rapida) hover:border-borda-forte hover:text-texto"
            >
              {texto}
            </button>
          ))}
        </div>
      </Card>

      {erro && (
        <Alerta className="mt-4" tipo="erro">
          {erro}
        </Alerta>
      )}

      {carregando ? (
        <div className="mt-5">
          <EsqueletoLista linhas={4} />
        </div>
      ) : (
        relatorio && (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Indicador rotulo="Escalações" valor={relatorio.totalEscalacoes} />
              <Indicador rotulo="Pessoas que serviram" valor={relatorio.pessoasQueServiram} />
              <Indicador
                rotulo="Sem servir no período"
                valor={relatorio.pessoasSemServir}
                alerta={relatorio.pessoasSemServir > 0}
              />
              <Indicador rotulo="Média por pessoa" valor={relatorio.mediaPorPessoa} decimais={1} />
            </div>

            {relatorio.linhas.length === 0 ? (
              <EstadoVazio
                className="mt-5"
                icone={<BarChart3 aria-hidden className="size-6" />}
                titulo="Ninguém neste ministério ainda"
                descricao="Adicione as pessoas na tela do ministério para o relatório fazer sentido."
                acao={
                  <BotaoLink variante="primario" to={`/ministerios/${ministerio.id}`}>
                    Abrir {ministerio.nome}
                  </BotaoLink>
                }
              />
            ) : (
              <motion.ul
                variants={listaEmCascata}
                initial="oculto"
                animate="visivel"
                className="mt-5 divide-y divide-borda overflow-hidden rounded-cartao border border-borda bg-superficie shadow-cartao"
              >
                {relatorio.linhas.map((linha) => (
                  <motion.li key={linha.perfilId} variants={itemDaLista} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate font-medium text-texto">{linha.nome}</span>
                          {!linha.aindaNoMinisterio && <Badge tom="neutro">Saiu do ministério</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-texto-suave">
                          {linha.vezes === 0
                            ? "Não serviu no período"
                            : `Última vez em ${formatarDia(linha.ultimaVez, fusoHorario ?? "UTC")}` +
                              (linha.funcoes.length > 0 ? ` · ${linha.funcoes.join(", ")}` : "")}
                        </p>
                        {linha.vezes > 0 && (
                          <p className="mt-1 text-sm text-texto-suave">
                            {linha.confirmadas} confirmadas · {linha.recusadas} recusadas ·{" "}
                            {linha.pendentes} pendentes
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <BarraDeParticipacao vezes={linha.vezes} maximo={maiorNumeroDeVezes} />
                        <span
                          className={
                            linha.vezes === 0
                              ? "w-8 text-right text-lg font-bold text-borda-forte"
                              : "w-8 text-right text-lg font-bold tabular-nums text-texto"
                          }
                        >
                          {linha.vezes}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </motion.ul>
            )}

            <p className="mt-3 text-sm text-texto-suave">
              Conta só escala publicada — rascunho ainda é intenção, não trabalho feito.
            </p>
          </>
        )
      )}
    </Layout>
  );
}

function Indicador({
  rotulo,
  valor,
  decimais = 0,
  alerta = false,
}: {
  rotulo: string;
  valor: number;
  decimais?: number;
  alerta?: boolean;
}) {
  return (
    <Card className={alerta ? "border-atencao/40 bg-atencao-suave" : undefined}>
      <p
        className={
          alerta
            ? "text-3xl font-bold tabular-nums text-atencao-forte"
            : "text-3xl font-bold tabular-nums text-texto"
        }
      >
        <NumeroContando valor={valor} decimais={decimais} />
        {/* O leitor de tela lê o valor final direto; a contagem é só visual. */}
        <span className="sr-only">{valor.toLocaleString("pt-BR")}</span>
      </p>
      <p className={alerta ? "mt-1 text-sm text-atencao-forte" : "mt-1 text-sm text-texto-suave"}>
        {rotulo}
      </p>
    </Card>
  );
}

/** Barra proporcional: o desequilíbrio salta aos olhos sem comparar número por número. */
function BarraDeParticipacao({ vezes, maximo }: { vezes: number; maximo: number }) {
  const transicao = useTransicao({ duration: 0.7, ease: [0.22, 1, 0.36, 1] });
  const proporcao = maximo > 0 ? vezes / maximo : 0;

  return (
    <div aria-hidden className="hidden h-2 w-24 overflow-hidden rounded-full bg-superficie-suave sm:block">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${proporcao * 100}%` }}
        transition={transicao}
        className="h-full rounded-full bg-linear-to-r from-marca-600 to-marca-800"
      />
    </div>
  );
}
