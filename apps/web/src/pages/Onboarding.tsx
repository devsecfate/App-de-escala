import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { criarIgreja, formatarCodigoConvite, usarConvite } from "@escala-app/core";
import { ArrowLeft, Church, Ticket } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { TelaCarregando } from "../components/TelaCarregando";
import { Alerta, Botao, Campo, CampoSelect } from "../components/ui";
import { lerCodigoConvite, limparCodigoConvite } from "../lib/convite-guardado";
import { mensagemDeErro } from "../lib/erros-auth";
import { FUSOS, fusoSugerido } from "../lib/fusos";

/**
 * Fusos do Brasil, do mais usado para o menos. Não é uma lista de todos os
 * fusos do mundo de propósito: um `<select>` com 400 opções num celular é pior
 * que não perguntar. O fuso da igreja decide o que é "hoje" e "este mês" no
 * relatório e no lembrete de véspera — errar aqui move o culto de domingo à
 * noite para o mês seguinte.
 */
type Porta = "codigo" | "igreja";

/**
 * Duas portas para quem está logado e ainda não pertence a nenhuma igreja.
 *
 * A tela antiga só tinha uma — "crie a igreja" — e mandava quem foi convidado
 * "pedir para o líder reenviar o convite para o seu e-mail", convite que não
 * existia. Quem não administrava a igreja ficava preso aqui.
 */
export function Onboarding() {
  const { session, perfil, carregando, erroConvite, recarregarPerfil, sair } = useAuth();
  const navigate = useNavigate();

  const [porta, setPorta] = useState<Porta>("codigo");
  const [codigo, setCodigo] = useState(() => formatarCodigoConvite(lerCodigoConvite() ?? ""));
  const [nomeIgreja, setNomeIgreja] = useState("");
  const [nomeResponsavel, setNomeResponsavel] = useState("");
  const [fuso, setFuso] = useState(fusoSugerido);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (carregando) {
    return <TelaCarregando />;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (perfil) {
    return <Navigate to="/" replace />;
  }

  async function handleUsarConvite(evento: FormEvent) {
    evento.preventDefault();
    if (!codigo.trim()) return;
    setErro(null);
    setEnviando(true);
    try {
      await usarConvite(supabase, codigo);
      limparCodigoConvite();
      await recarregarPerfil();
      navigate("/", { replace: true });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível usar este código."));
    } finally {
      setEnviando(false);
    }
  }

  async function handleCriarIgreja(evento: FormEvent) {
    evento.preventDefault();
    if (!nomeIgreja.trim()) return;
    setErro(null);
    setEnviando(true);
    try {
      await criarIgreja(supabase, nomeIgreja.trim(), fuso, nomeResponsavel.trim() || undefined);
      await recarregarPerfil();
      navigate("/", { replace: true });
    } catch (problema) {
      setErro(mensagemDeErro(problema, "Não foi possível criar a igreja."));
    } finally {
      setEnviando(false);
    }
  }

  const rodape = (
    <button
      type="button"
      onClick={() => void sair()}
      className="text-texto-suave underline-offset-4 hover:text-texto hover:underline"
    >
      Sair desta conta
    </button>
  );

  if (porta === "igreja") {
    return (
      <AuthLayout
        titulo="Criar a igreja"
        descricao="Você vira o administrador e passa a convidar os líderes."
        rodape={rodape}
      >
        <form onSubmit={handleCriarIgreja} className="space-y-4">
          <Campo
            rotulo="Nome da igreja"
            type="text"
            required
            value={nomeIgreja}
            onChange={(evento) => setNomeIgreja(evento.target.value)}
            placeholder="Igreja Batista Central"
          />

          <Campo
            rotulo="Seu nome"
            type="text"
            autoComplete="name"
            value={nomeResponsavel}
            onChange={(evento) => setNomeResponsavel(evento.target.value)}
            placeholder="Maria Silva"
            dica="Como você aparece para a equipe. Em branco, usamos o nome do cadastro."
          />

          <CampoSelect
            rotulo="Fuso horário da igreja"
            value={fuso}
            onChange={(evento) => setFuso(evento.target.value)}
            dica="Define o que conta como “hoje” nas escalas, nos lembretes e no relatório."
          >
            {FUSOS.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </CampoSelect>

          {erro && <Alerta tipo="erro">{erro}</Alerta>}

          <Botao type="submit" tamanho="grande" carregando={enviando}>
            Criar igreja e começar
          </Botao>

          <Botao
            variante="fantasma"
            larguraTotal
            icone={<ArrowLeft aria-hidden className="size-4" />}
            onClick={() => {
              setErro(null);
              setPorta("codigo");
            }}
          >
            Na verdade eu tenho um código
          </Botao>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      titulo="Falta entrar na sua igreja"
      descricao="Sua conta está pronta. Agora use o código que o líder mandou."
      rodape={rodape}
    >
      <form onSubmit={handleUsarConvite} className="space-y-4">
        <Campo
          rotulo="Código do convite"
          type="text"
          required
          autoFocus
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          value={codigo}
          onChange={(evento) => setCodigo(evento.target.value.toUpperCase())}
          placeholder="ABCD-2345"
          className="text-center font-mono text-lg tracking-[0.3em]"
          dica="Oito letras e números. Maiúscula, minúscula e hífen tanto faz."
        />

        {(erro ?? erroConvite) && <Alerta tipo="erro">{erro ?? erroConvite}</Alerta>}

        <Botao
          type="submit"
          tamanho="grande"
          carregando={enviando}
          icone={<Ticket aria-hidden className="size-4" />}
        >
          Entrar na igreja
        </Botao>
      </form>

      <div className="mt-5 border-t border-borda pt-4">
        <p className="text-sm text-texto-suave">
          Não recebeu nenhum código? Peça ao líder do seu ministério — ele gera um pelo app.
        </p>
        <Botao
          variante="secundario"
          larguraTotal
          className="mt-3"
          icone={<Church aria-hidden className="size-4" />}
          onClick={() => {
            setErro(null);
            setPorta("igreja");
          }}
        >
          Sou eu quem administra a igreja
        </Botao>
      </div>
    </AuthLayout>
  );
}
