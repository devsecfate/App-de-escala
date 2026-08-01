import { useAuth } from "../context/AuthContext";

export function Home() {
  const { session, sair } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-900">Minhas escalas</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-500">{session?.user.email}</span>
          <button
            type="button"
            onClick={() => void sair()}
            className="text-sm text-slate-500 underline hover:text-slate-700"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 text-center">
        <p className="text-slate-500">
          Você ainda não tem escalas por aqui. Quando um líder te escalar, os próximos
          compromissos aparecem nesta tela.
        </p>
      </main>
    </div>
  );
}
