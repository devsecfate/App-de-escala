import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { criarMinisterio, listarMinisterios, type Ministerio } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

export function Ministerios() {
  const { perfil } = useAuth();
  const [ministerios, setMinisterios] = useState<Ministerio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nomeNovo, setNomeNovo] = useState("");
  const [criando, setCriando] = useState(false);

  async function carregar() {
    if (!perfil) return;
    setCarregando(true);
    try {
      setMinisterios(await listarMinisterios(supabase, perfil.igrejaId));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar os ministérios.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.igrejaId]);

  async function handleCriar(event: FormEvent) {
    event.preventDefault();
    if (!perfil || !nomeNovo.trim()) return;
    setCriando(true);
    setErro(null);
    try {
      await criarMinisterio(supabase, perfil.igrejaId, nomeNovo.trim());
      setNomeNovo("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar o ministério.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-slate-900">Ministérios</h1>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {carregando ? (
        <p className="mt-4 text-sm text-slate-500">Carregando...</p>
      ) : ministerios.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Nenhum ministério cadastrado ainda.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {ministerios.map((ministerio) => (
            <li key={ministerio.id}>
              <Link
                to={`/ministerios/${ministerio.id}`}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{ministerio.nome}</span>
                <span className="text-slate-400">Ver detalhes →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {perfil?.papelGlobal === "admin" && (
        <form onSubmit={handleCriar} className="mt-6 flex gap-2">
          <input
            type="text"
            value={nomeNovo}
            onChange={(event) => setNomeNovo(event.target.value)}
            placeholder="Nome do novo ministério"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={criando}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Criar
          </button>
        </form>
      )}
    </Layout>
  );
}
