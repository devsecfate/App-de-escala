import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Login() {
  const { session, entrarComSenha, enviarLinkMagico } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleEntrarComSenha(event: FormEvent) {
    event.preventDefault();
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    const { erro: erroLogin } = await entrarComSenha(email, senha);
    setEnviando(false);
    if (erroLogin) {
      setErro(erroLogin);
    }
  }

  async function handleLinkMagico() {
    if (!email) {
      setErro("Digite seu e-mail para receber o link mágico.");
      return;
    }
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    const { erro: erroLink } = await enviarLinkMagico(email);
    setEnviando(false);
    if (erroLink) {
      setErro(erroLink);
    } else {
      setMensagem("Link enviado! Confira seu e-mail.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">App de Escala</h1>
        <p className="mt-1 text-sm text-slate-500">Entre para ver as escalas do seu ministério.</p>

        <form onSubmit={handleEntrarComSenha} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="voce@igreja.test"
            />
          </div>

          <div>
            <label htmlFor="senha" className="block text-sm font-medium text-slate-700">
              Senha
            </label>
            <input
              id="senha"
              type="password"
              required
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="••••••••"
            />
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}
          {mensagem && <p className="text-sm text-emerald-600">{mensagem}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Entrar
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleLinkMagico}
            disabled={enviando}
            className="text-sm text-slate-500 underline hover:text-slate-700 disabled:opacity-50"
          >
            Entrar com link mágico por e-mail
          </button>
        </div>
      </div>
    </div>
  );
}
