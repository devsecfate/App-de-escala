import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { formatarCodigoConvite } from "@escala-app/core";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Alerta, Botao, Campo, CampoSenha } from "../components/ui";
import { guardarCodigoConvite } from "../lib/convite-guardado";

const TAMANHO_MINIMO_DA_SENHA = 6;

/**
 * Cadastro de verdade — o que faltava no app.
 *
 * Até aqui nada no repositório chamava `signUp`: quem "criava conta" na
 * prática usava o link mágico escondido embaixo do formulário de login, e
 * nunca definia senha. Era exatamente onde o usuário travava.
 *
 * O código do convite é opcional e vem pré-preenchido por `?convite=` (o link
 * que o líder manda no WhatsApp). Ele é guardado antes do `signUp` porque a
 * URL se perde na navegação — quem aplica o código é o AuthContext, assim que
 * a sessão existe.
 */
export function Cadastrar() {
  const { session, cadastrar } = useAuth();
  const [parametros] = useSearchParams();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState(() => formatarCodigoConvite(parametros.get("convite") ?? ""));
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (session) {
    return <Navigate to="/" replace />;
  }

  async function handleCadastrar(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);

    if (!nome.trim()) {
      setErro("Diga seu nome — é ele que o líder vê na escala.");
      return;
    }
    if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
      setErro(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`);
      return;
    }

    setEnviando(true);
    if (codigo.trim()) {
      guardarCodigoConvite(codigo);
    }

    const { erro: erroCadastro } = await cadastrar(nome, email, senha);
    setEnviando(false);
    if (erroCadastro) setErro(erroCadastro);
    // Deu certo: a sessão aparece sozinha (sem confirmação de e-mail) e o
    // <Navigate> acima leva para a Home.
  }

  return (
    <AuthLayout
      titulo="Criar conta"
      descricao="Leva menos de um minuto. Não precisa confirmar e-mail."
      rodape={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-semibold text-marca-700 underline-offset-4 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={handleCadastrar} className="space-y-4">
        <Campo
          rotulo="Seu nome"
          type="text"
          required
          autoComplete="name"
          value={nome}
          onChange={(evento) => setNome(evento.target.value)}
          placeholder="Maria Silva"
          dica="É este nome que aparece na escala."
        />

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

        <CampoSenha
          required
          autoComplete="new-password"
          minLength={TAMANHO_MINIMO_DA_SENHA}
          value={senha}
          onChange={(evento) => setSenha(evento.target.value)}
          placeholder="••••••••"
          dica={`Pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}
        />

        <Campo
          rotulo="Código do convite (opcional)"
          type="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          className="font-mono tracking-widest"
          dica="Recebeu um código do líder? Cole aqui e você já entra no ministério."
        />

        {erro && <Alerta tipo="erro">{erro}</Alerta>}

        <Botao type="submit" tamanho="grande" carregando={enviando}>
          Criar conta
        </Botao>
      </form>
    </AuthLayout>
  );
}
