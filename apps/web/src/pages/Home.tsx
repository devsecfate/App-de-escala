import { useEffect, useState } from "react";
import { confirmarPresenca, listarMinhasEscalacoes, type MinhaEscalacao } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";
import { AtivarAvisos } from "../components/AtivarAvisos";

function rotuloConfirmacao(confirmacao: string): { texto: string; classe: string } {
  if (confirmacao === "confirmado") return { texto: "Confirmado", classe: "bg-emerald-100 text-emerald-700" };
  if (confirmacao === "recusado") return { texto: "Não vou", classe: "bg-red-100 text-red-700" };
  return { texto: "Pendente", classe: "bg-amber-100 text-amber-700" };
}

function formatarDataHora(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Home() {
  const { perfil } = useAuth();
  const [escalacoes, setEscalacoes] = useState<MinhaEscalacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [respondendo, setRespondendo] = useState<string | null>(null);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      setEscalacoes(await listarMinhasEscalacoes(supabase, perfil.id));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar suas escalas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function handleResponder(escalacaoId: string, confirmacao: "confirmado" | "recusado") {
    setRespondendo(escalacaoId);
    setErro(null);
    try {
      await confirmarPresenca(supabase, escalacaoId, confirmacao);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível registrar sua resposta.");
    } finally {
      setRespondendo(null);
    }
  }

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-slate-900">Minhas escalas</h1>

      <AtivarAvisos />

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {carregando ? (
        <p className="mt-4 text-sm text-slate-500">Carregando...</p>
      ) : escalacoes.length === 0 ? (
        <p className="mt-6 text-center text-slate-500">
          Você ainda não tem escalas por aqui. Quando um líder te escalar, os próximos
          compromissos aparecem nesta tela.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {escalacoes.map((escalacao) => {
            const rotulo = rotuloConfirmacao(escalacao.confirmacao);
            return (
              <li key={escalacao.escalacaoId} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-slate-500">{escalacao.ministerioNome}</p>
                    <p className="font-medium text-slate-900">{escalacao.eventoTitulo}</p>
                    <p className="text-sm text-slate-500">{formatarDataHora(escalacao.dataHora)}</p>
                    <p className="mt-1 text-sm text-slate-700">Função: {escalacao.funcaoNome}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${rotulo.classe}`}>
                    {rotulo.texto}
                  </span>
                </div>

                {escalacao.confirmacao === "pendente" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={respondendo === escalacao.escalacaoId}
                      onClick={() => void handleResponder(escalacao.escalacaoId, "confirmado")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      disabled={respondendo === escalacao.escalacaoId}
                      onClick={() => void handleResponder(escalacao.escalacaoId, "recusado")}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Não posso
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}
