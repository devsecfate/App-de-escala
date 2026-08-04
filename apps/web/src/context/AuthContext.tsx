import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { obterMeuPerfil, usarConvite, type Perfil } from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { limparDadosOffline } from "../lib/offline";
import { lerCodigoConvite, limparCodigoConvite } from "../lib/convite-guardado";
import { mensagemDeErro, traduzirErroAuth } from "../lib/erros-auth";

interface Resultado {
  erro: string | null;
}

interface AuthContextValue {
  session: Session | null;
  perfil: Perfil | null;
  /** true enquanto a sessão OU o perfil desta sessão ainda não foram resolvidos. */
  carregando: boolean;
  /** Falha ao tentar aplicar o código de convite guardado, se houve. */
  erroConvite: string | null;
  entrarComSenha: (email: string, senha: string) => Promise<Resultado>;
  cadastrar: (nome: string, email: string, senha: string) => Promise<Resultado>;
  enviarLinkMagico: (email: string) => Promise<Resultado>;
  enviarRedefinicaoDeSenha: (email: string) => Promise<Resultado>;
  definirNovaSenha: (senha: string) => Promise<Resultado>;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * O GoTrue devolve "User from sub claim in JWT does not exist" quando a sessão
 * guardada no aparelho aponta para uma conta que já não existe — conta excluída
 * noutro aparelho, ou banco recriado em desenvolvimento.
 */
function usuarioSumiu(erro: unknown): boolean {
  if (!erro || typeof erro !== "object" || !("message" in erro)) return false;
  const mensagem = (erro as { message?: unknown }).message;
  return typeof mensagem === "string" && /sub claim in jwt does not exist/i.test(mensagem);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [erroConvite, setErroConvite] = useState<string | null>(null);

  /**
   * Id do usuário cujo perfil já foi resolvido (achado OU confirmado que não
   * existe). É o que fecha o bug de rota: o cálculo antigo de `carregando`
   * abria uma janela em que a sessão já existia, o perfil ainda era null e
   * `carregando` já era false. Como o efeito do filho roda antes do efeito do
   * provider, TODA recarga de página passava por /onboarding e voltava —
   * qualquer deep link se perdia no refresh.
   *
   * Comparando com `session.user.id` não existe janela: enquanto o id não
   * bater, ainda está carregando, por construção.
   */
  const [perfilResolvidoPara, setPerfilResolvidoPara] = useState<string | null>(null);
  const aplicandoConvite = useRef(false);

  const buscarPerfil = useCallback(async (userId: string): Promise<Perfil | null> => {
    try {
      const perfilAtual = await obterMeuPerfil(supabase);
      setPerfil(perfilAtual);
      return perfilAtual;
    } catch (erro) {
      // Resolver mesmo em erro; senão a tela fica num "Carregando..." eterno.
      setPerfil(null);

      // O token aponta para um usuário que não existe mais. Ficou alcançável
      // quando o app ganhou "excluir minha conta": quem exclui num aparelho
      // deixa o outro com uma sessão órfã. Sem este tratamento o outro aparelho
      // cai no onboarding pedindo código de convite, como se a pessoa fosse
      // nova na igreja — em vez de dizer que a sessão acabou.
      if (usuarioSumiu(erro)) {
        await supabase.auth.signOut();
        return null;
      }

      console.error("Falha ao carregar o perfil:", erro);
      return null;
    } finally {
      setPerfilResolvidoPara(userId);
    }
  }, []);

  const recarregarPerfil = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) return;
    await buscarPerfil(userId);
  }, [session?.user.id, buscarPerfil]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregandoSessao(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setPerfil(null);
      setPerfilResolvidoPara(null);
      setErroConvite(null);
      return;
    }

    let cancelado = false;

    void (async () => {
      const perfilAtual = await buscarPerfil(userId);
      if (cancelado || perfilAtual) return;

      // Sem perfil: se a pessoa veio de um link de convite, é aqui que o
      // código guardado vira vínculo — antes de mandá-la para o onboarding,
      // que só faz sentido para quem administra a igreja.
      const codigo = lerCodigoConvite();
      if (!codigo || aplicandoConvite.current) return;

      aplicandoConvite.current = true;
      try {
        await usarConvite(supabase, codigo);
        limparCodigoConvite();
        setErroConvite(null);
        if (!cancelado) await buscarPerfil(userId);
      } catch (erro) {
        // Guardamos o código: o onboarding mostra o campo preenchido com ele
        // e a mensagem do banco ("Este convite venceu.", etc.).
        if (!cancelado) setErroConvite(mensagemDeErro(erro, "Não foi possível usar o convite."));
      } finally {
        aplicandoConvite.current = false;
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [session?.user.id, buscarPerfil]);

  async function entrarComSenha(email: string, senha: string): Promise<Resultado> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    return { erro: error ? traduzirErroAuth(error.message) : null };
  }

  /**
   * Cria a conta. O nome vai em `options.data`, ou seja, no `user_metadata` do
   * usuário — é de lá que `criar_igreja` e `usar_convite` leem o nome do
   * perfil. Sem confirmação de e-mail (decisão da Etapa 6), o Supabase já
   * devolve a sessão e a pessoa entra direto.
   */
  async function cadastrar(nome: string, email: string, senha: string): Promise<Resultado> {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() } },
    });
    return { erro: error ? traduzirErroAuth(error.message) : null };
  }

  async function enviarLinkMagico(email: string): Promise<Resultado> {
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    return { erro: error ? traduzirErroAuth(error.message) : null };
  }

  async function enviarRedefinicaoDeSenha(email: string): Promise<Resultado> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    });
    return { erro: error ? traduzirErroAuth(error.message) : null };
  }

  async function definirNovaSenha(senha: string): Promise<Resultado> {
    const { error } = await supabase.auth.updateUser({ password: senha });
    return { erro: error ? traduzirErroAuth(error.message) : null };
  }

  async function sair() {
    try {
      await supabase.auth.signOut();
    } finally {
      // Mesmo se o signOut falhar (sem internet, por exemplo), o que está
      // guardado no aparelho tem que sair junto: celular emprestado na igreja
      // não pode mostrar a escala de quem logou antes.
      limparCodigoConvite();
      await limparDadosOffline();
    }
  }

  const carregando = carregandoSessao || (!!session && perfilResolvidoPara !== session.user.id);

  return (
    <AuthContext.Provider
      value={{
        session,
        perfil,
        carregando,
        erroConvite,
        entrarComSenha,
        cadastrar,
        enviarLinkMagico,
        enviarRedefinicaoDeSenha,
        definirNovaSenha,
        sair,
        recarregarPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth precisa ser usado dentro de <AuthProvider>.");
  }
  return context;
}
