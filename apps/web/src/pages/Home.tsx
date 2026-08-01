import { useEffect, useState } from "react";
import { listarMinhasEscalacoes, type MinhaEscalacao } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

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

  useEffect(() => {
    if (!perfil) return;
    setCarregando(true);
    listarMinhasEscalacoes(supabase, perfil.id)
      .then(setEscalacoes)
      .catch((error: unknown) =>
        setErro(error instanceof Error ? error.message : "Não foi possível carregar suas escalas."),
      )
      .finally(() => setCarregando(false));
  }, [perfil]);

  return (
    <Layout>
      <h1 className="text-lg font-semibold text-slate-900">Minhas escalas</h1>

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
          {escalacoes.map((escalacao) => (
            <li key={escalacao.escalacaoId} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{escalacao.ministerioNome}</p>
              <p className="font-medium text-slate-900">{escalacao.eventoTitulo}</p>
              <p className="text-sm text-slate-500">{formatarDataHora(escalacao.dataHora)}</p>
              <p className="mt-1 text-sm text-slate-700">Função: {escalacao.funcaoNome}</p>
            </li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
