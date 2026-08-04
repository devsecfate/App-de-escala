import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { Alerta, Botao, Campo, CampoSenha } from "../components/ui";

const TAMANHO_MINIMO_DA_SENHA = 6;

/**
 * Uma tela, dois momentos:
 *
 * 1. sem sessão — pede o e-mail e manda o link de redefinição;
 * 2. com sessão — pede a senha nova. É o estado de quem acabou de abrir o link
 *    do e-mail (o supabase-js lê o token da URL e já cria a sessão), e também
 *    o de quem só quer trocar a senha estando logado.
 */
export function RedefinirSenha() {
  const { session, enviarRedefinicaoDeSenha, definirNovaSenha } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleEnviarLink(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setMensagem(null);
    setEnviando(true);
    const { erro: problema } = await enviarRedefinicaoDeSenha(email);
    setEnviando(false);
    if (problema) {
      setErro(problema);
      return;
    }
    setMensagem(
      "Se existe uma conta com este e-mail, o link já está a caminho. " +
        "Abra a mensagem neste mesmo aparelho.",
    );
  }

  async function handleDefinirSenha(evento: FormEvent) {
    evento.preventDefault();
    setErro(null);
    setMensagem(null);

    if (senha.length < TAMANHO_MINIMO_DA_SENHA) {
      setErro(`A senha precisa ter pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`);
      return;
    }

    setEnviando(true);
    const { erro: problema } = await definirNovaSenha(senha);
    setEnviando(false);
    if (problema) {
      setErro(problema);
      return;
    }
    setMensagem("Senha alterada. Já dá para usar ela no próximo login.");
    setSenha("");
    setTimeout(() => navigate("/", { replace: true }), 1200);
  }

  if (session) {
    return (
      <AuthLayout
        titulo="Definir nova senha"
        descricao="Escolha a senha que você vai usar para entrar."
        rodape={
          <Link to="/" className="font-semibold text-marca-700 underline-offset-4 hover:underline">
            Voltar para o app
          </Link>
        }
      >
        <form onSubmit={handleDefinirSenha} className="space-y-4">
          <CampoSenha
            rotulo="Nova senha"
            required
            autoComplete="new-password"
            minLength={TAMANHO_MINIMO_DA_SENHA}
            value={senha}
            onChange={(evento) => setSenha(evento.target.value)}
            placeholder="••••••••"
            dica={`Pelo menos ${TAMANHO_MINIMO_DA_SENHA} caracteres.`}
          />

          {erro && <Alerta tipo="erro">{erro}</Alerta>}
          {mensagem && <Alerta tipo="sucesso">{mensagem}</Alerta>}

          <Botao type="submit" tamanho="grande" carregando={enviando}>
            Salvar senha
          </Botao>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Esqueci minha senha"
      descricao="Mandamos um link por e-mail para você escolher uma nova."
      rodape={
        <Link to="/login" className="font-semibold text-marca-700 underline-offset-4 hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={handleEnviarLink} className="space-y-4">
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

        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        {mensagem && <Alerta tipo="sucesso">{mensagem}</Alerta>}

        <Botao type="submit" tamanho="grande" carregando={enviando}>
          Enviar link
        </Botao>
      </form>
    </AuthLayout>
  );
}
