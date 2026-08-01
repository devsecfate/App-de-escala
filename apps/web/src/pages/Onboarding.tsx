import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { criarIgreja } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export function Onboarding() {
  const { session, perfil, carregando, recarregarPerfil, sair } = useAuth();
  const navigate = useNavigate();
  const [nomeIgreja, setNomeIgreja] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Carregando...
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (perfil) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!nomeIgreja.trim()) return;
    setErro(null);
    setEnviando(true);
    try {
      await criarIgreja(supabase, nomeIgreja.trim());
      await recarregarPerfil();
      navigate("/", { replace: true });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar a igreja.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Bem-vindo(a) ao App de Escala</h1>
        <p className="mt-1 text-sm text-slate-500">
          Você ainda não está vinculado(a) a nenhuma igreja. Se você é quem vai administrar o app
          na sua igreja, crie a igreja abaixo. Se você foi convidado(a) por um líder, peça para ele
          reenviar o convite para o seu e-mail.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="nomeIgreja" className="block text-sm font-medium text-slate-700">
              Nome da igreja
            </label>
            <input
              id="nomeIgreja"
              type="text"
              required
              value={nomeIgreja}
              onChange={(event) => setNomeIgreja(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="Igreja Exemplo"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {enviando ? "Criando..." : "Criar igreja e começar"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => void sair()}
          className="mt-4 text-sm text-slate-500 underline hover:text-slate-700"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
