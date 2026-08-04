import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Alerta, Botao, Campo, CampoSenha } from "../components/ui";

interface EstadoDeOrigem {
  de?: { pathname?: string };
}

export function Login() {
  const { session, entrarComSenha, enviarLinkMagico } = useAuth();
  const localizacao = useLocation();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (session) {
    // Volta para a página que a pessoa tentou abrir antes de ser mandada aqui.
    const destino = (localizacao.state as EstadoDeOrigem | null)?.de?.pathname ?? "/";
    return <Navigate to={destino} replace />;
  }

  async function handleEntrar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    const { erro: erroLogin } = await entrarComSenha(email, senha);
    setEnviando(false);
    if (erroLogin) setErro(erroLogin);
  }

  async function handleLinkMagico() {
    if (!email.trim()) {
      setErro("Digite seu e-mail para receber o link.");
      return;
    }
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    const { erro: erroLink } = await enviarLinkMagico(email);
    setEnviando(false);
    if (erroLink) setErro(erroLink);
    else setMensagem("Link enviado! Confira seu e-mail e abra a mensagem neste aparelho.");
  }

  return (
    <AuthLayout
      titulo="App de Escala"
      descricao="Entre para ver as escalas do seu ministério."
      rodape={
        <>
          Ainda não tem conta?{" "}
          <Link to="/cadastrar" className="font-semibold text-marca-700 underline-offset-4 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={handleEntrar} className="space-y-4">
        <Campo
          rotulo="E-mail"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          placeholder="voce@exemplo.com"
        />

        <div>
          <CampoSenha
            required
            autoComplete="current-password"
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            placeholder="••••••••"
          />
          <div className="mt-2 text-right">
            <Link
              to="/redefinir-senha"
              className="text-sm font-medium text-marca-700 underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        {mensagem && <Alerta tipo="sucesso">{mensagem}</Alerta>}

        <Botao type="submit" tamanho="grande" carregando={enviando}>
          Entrar
        </Botao>
      </form>

      {/* Caminho de saída para quem nunca definiu senha (conta criada por link
          mágico antes desta etapa). Fica discreto de propósito: o caminho
          principal é e-mail + senha. */}
      <div className="mt-5 border-t border-borda pt-4 text-center">
        <button
          type="button"
          onClick={() => void handleLinkMagico()}
          disabled={enviando}
          className="text-sm text-texto-suave underline-offset-4 hover:text-texto hover:underline disabled:opacity-50"
        >
          Entrar por link no e-mail, sem senha
        </button>
      </div>
    </AuthLayout>
  );
}
