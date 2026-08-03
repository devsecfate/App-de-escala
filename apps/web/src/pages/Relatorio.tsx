import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
      } catch (error) {
        if (!cancelado) {
          setErro(error instanceof Error ? error.message : "Não foi possível abrir o relatório.");
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
      .catch((error: unknown) => {
        if (!cancelado) {
          setErro(error instanceof Error ? error.message : "Não foi possível carregar o relatório.");
        }
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

  function aplicarAtalho(atalho: "mes" | "mesPassado" | "tresMeses" | "ano") {
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
        <p className="text-sm text-slate-500">Carregando...</p>
      </Layout>
    );
  }

  if (!ministerio) {
    return (
      <Layout>
        <p className="text-sm text-red-600">{erro ?? "Ministério não encontrado."}</p>
      </Layout>
    );
  }

  if (!souLider) {
    return (
      <Layout>
        <h1 className="text-lg font-semibold text-slate-900">{ministerio.nome}</h1>
        <p className="mt-4 text-sm text-slate-600">
          O relatório de participação é do líder do ministério.
        </p>
        <Link to={`/ministerios/${ministerio.id}`} className="mt-4 inline-block text-sm text-slate-500 underline">
          Voltar ao ministério
        </Link>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Participação · {ministerio.nome}</h1>
          <p className="text-sm text-slate-500">Quantas vezes cada pessoa serviu no período.</p>
        </div>
        <Link
          to={`/ministerios/${ministerio.id}`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Voltar ao ministério
        </Link>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            De
            <input
              type="date"
              value={periodo?.inicio ?? ""}
              onChange={(evento) =>
                setPeriodo((atual) => (atual ? { ...atual, inicio: evento.target.value } : atual))
              }
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            Até
            <input
              type="date"
              value={periodo?.fim ?? ""}
              onChange={(evento) =>
                setPeriodo((atual) => (atual ? { ...atual, fim: evento.target.value } : atual))
              }
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["mes", "Este mês"],
                ["mesPassado", "Mês passado"],
                ["tresMeses", "Últimos 3 meses"],
                ["ano", "Este ano"],
              ] as const
            ).map(([atalho, texto]) => (
              <button
                key={atalho}
                type="button"
                onClick={() => aplicarAtalho(atalho)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
      </section>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {carregando && <p className="mt-4 text-sm text-slate-500">Carregando...</p>}

      {relatorio && !carregando && (
        <>
          <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Escalações", relatorio.totalEscalacoes],
              ["Pessoas que serviram", relatorio.pessoasQueServiram],
              ["Sem servir no período", relatorio.pessoasSemServir],
              ["Média por pessoa", relatorio.mediaPorPessoa],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-semibold text-slate-900">{valor}</p>
                <p className="text-xs text-slate-500">{rotulo}</p>
              </div>
            ))}
          </section>

          {relatorio.linhas.length === 0 ? (
            <p className="mt-6 text-center text-slate-500">
              Ninguém neste ministério ainda. Cadastre as pessoas para o relatório fazer sentido.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {relatorio.linhas.map((linha) => (
                <li key={linha.perfilId} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {linha.nome}
                        {!linha.aindaNoMinisterio && (
                          <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                            saiu do ministério
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        {linha.vezes === 0
                          ? "Não serviu no período"
                          : `Última vez em ${formatarDia(linha.ultimaVez, fusoHorario ?? "UTC")}` +
                            (linha.funcoes.length > 0 ? ` · ${linha.funcoes.join(", ")}` : "")}
                      </p>
                      {linha.vezes > 0 && (
                        <p className="mt-1 text-xs text-slate-500">
                          {linha.confirmadas} confirmadas · {linha.recusadas} recusadas ·{" "}
                          {linha.pendentes} pendentes
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {/* Barra proporcional: o desequilíbrio salta aos olhos sem precisar
                          comparar número por número. */}
                      <div className="hidden h-2 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{
                            width: maiorNumeroDeVezes
                              ? `${(linha.vezes / maiorNumeroDeVezes) * 100}%`
                              : "0%",
                          }}
                        />
                      </div>
                      <span
                        className={`w-10 text-right text-lg font-semibold ${
                          linha.vezes === 0 ? "text-slate-300" : "text-slate-900"
                        }`}
                      >
                        {linha.vezes}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-3 text-xs text-slate-500">
            Conta só escala publicada — rascunho ainda é intenção, não trabalho feito.
          </p>
        </>
      )}
    </Layout>
  );
}
