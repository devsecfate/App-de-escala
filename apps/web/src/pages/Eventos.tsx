import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { criarEvento, listarMinisteriosLideradosPor, listarProximosEventos, type Evento } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function Eventos() {
  const { perfil } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [ministeriosLiderados, setMinisteriosLiderados] = useState<{ ministerioId: string; ministerioNome: string }[]>(
    [],
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [dataHora, setDataHora] = useState("");
  const [tipo, setTipo] = useState("culto");
  const [criando, setCriando] = useState(false);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      const [eventosCarregados, liderados] = await Promise.all([
        listarProximosEventos(supabase, perfil.igrejaId),
        listarMinisteriosLideradosPor(supabase, perfil.id),
      ]);
      setEventos(eventosCarregados);
      setMinisteriosLiderados(liderados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os eventos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.id]);

  const podeCriarEvento = perfil?.papelGlobal === "admin" || ministeriosLiderados.length > 0;

  async function handleCriar(event: FormEvent) {
    event.preventDefault();
    if (!perfil || !titulo.trim() || !dataHora) return;
    setCriando(true);
    setErro(null);
    try {
      await criarEvento(supabase, perfil.igrejaId, titulo.trim(), new Date(dataHora).toISOString(), tipo);
      setTitulo("");
      setDataHora("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar o evento.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-slate-900">Eventos</h1>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {carregando ? (
        <p className="mt-4 text-sm text-slate-500">Carregando...</p>
      ) : eventos.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhum evento futuro cadastrado.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {eventos.map((evento) => (
            <li key={evento.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="font-medium text-slate-900">{evento.titulo}</p>
              <p className="text-sm text-slate-500">{formatarDataHora(evento.dataHora)}</p>

              {ministeriosLiderados.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ministeriosLiderados.map((m) => (
                    <Link
                      key={m.ministerioId}
                      to={`/eventos/${evento.id}/ministerios/${m.ministerioId}/escala`}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Montar escala · {m.ministerioNome}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeCriarEvento && (
        <form onSubmit={handleCriar} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-medium text-slate-700">Novo evento</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              type="text"
              placeholder="Título (ex: Culto de domingo)"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="datetime-local"
              value={dataHora}
              onChange={(event) => setDataHora(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={tipo}
              onChange={(event) => setTipo(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="culto">Culto</option>
              <option value="ensaio">Ensaio</option>
              <option value="evento">Evento</option>
            </select>
            <button
              type="submit"
              disabled={criando}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Criar
            </button>
          </div>
        </form>
      )}
    </Layout>
  );
}
