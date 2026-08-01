import { useEffect, useState, type FormEvent } from "react";
import {
  criarIndisponibilidade,
  listarIndisponibilidades,
  removerIndisponibilidade,
  type Indisponibilidade,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

function formatarData(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
}

export function Disponibilidade() {
  const { perfil } = useAuth();

  const [indisponibilidades, setIndisponibilidades] = useState<Indisponibilidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [semDataFim, setSemDataFim] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    setErro(null);
    try {
      setIndisponibilidades(await listarIndisponibilidades(supabase, perfil.id));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar sua disponibilidade.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  async function handleCriar(event: FormEvent) {
    event.preventDefault();
    if (!perfil || !dataInicio) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarIndisponibilidade(
        supabase,
        perfil.id,
        dataInicio,
        semDataFim ? null : dataFim || dataInicio,
        motivo.trim() || undefined,
      );
      setDataInicio("");
      setDataFim("");
      setSemDataFim(false);
      setMotivo("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a indisponibilidade.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleRemover(id: string) {
    try {
      await removerIndisponibilidade(supabase, id);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível remover.");
    }
  }

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-slate-900">Minha disponibilidade</h1>
      <p className="mt-1 text-sm text-slate-500">
        Marque os períodos em que você não pode servir. Os líderes dos seus ministérios veem isso ao montar a
        escala.
      </p>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {carregando ? (
        <p className="mt-4 text-sm text-slate-500">Carregando...</p>
      ) : indisponibilidades.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nenhuma indisponibilidade cadastrada.</p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {indisponibilidades.map((ind) => (
            <li key={ind.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">
                  {formatarData(ind.dataInicio)} — {ind.dataFim ? formatarData(ind.dataFim) : "em aberto"}
                </p>
                {ind.motivo && <p className="text-slate-500">{ind.motivo}</p>}
              </div>
              <button
                type="button"
                onClick={() => void handleRemover(ind.id)}
                className="text-xs text-red-600 underline hover:text-red-700"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCriar} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Nova indisponibilidade</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className="text-sm text-slate-600">
            Início
            <input
              type="date"
              value={dataInicio}
              onChange={(event) => setDataInicio(event.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm text-slate-600">
            Fim
            <input
              type="date"
              value={dataFim}
              onChange={(event) => setDataFim(event.target.value)}
              disabled={semDataFim}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
            />
          </label>
        </div>
        <label className="mt-2 flex items-center gap-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={semDataFim}
            onChange={(event) => setSemDataFim(event.target.checked)}
          />
          Em aberto (sem data para voltar)
        </label>
        <input
          type="text"
          placeholder="Motivo (opcional)"
          value={motivo}
          onChange={(event) => setMotivo(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={salvando || !dataInicio}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {salvando ? "Salvando..." : "Adicionar"}
        </button>
      </form>
    </Layout>
  );
}
