import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { obterMeuPerfil, type Perfil } from "@escala-app/core";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  perfil: Perfil | null;
  /** true enquanto a sessão OU o perfil ainda estão carregando. */
  carregando: boolean;
  entrarComSenha: (email: string, senha: string) => Promise<{ erro: string | null }>;
  enviarLinkMagico: (email: string) => Promise<{ erro: string | null }>;
  sair: () => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);

  const recarregarPerfil = useCallback(async () => {
    setCarregandoPerfil(true);
    try {
      const perfilAtual = await obterMeuPerfil(supabase);
      setPerfil(perfilAtual);
    } finally {
      setCarregandoPerfil(false);
    }
  }, []);

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
    if (session) {
      void recarregarPerfil();
    } else {
      setPerfil(null);
    }
  }, [session, recarregarPerfil]);

  async function entrarComSenha(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    return { erro: error?.message ?? null };
  }

  async function enviarLinkMagico(email: string) {
    const { error } = await supabase.auth.signInWithOtp({ email });
    return { erro: error?.message ?? null };
  }

  async function sair() {
    await supabase.auth.signOut();
  }

  const carregando = carregandoSessao || (!!session && carregandoPerfil && !perfil);

  return (
    <AuthContext.Provider
      value={{ session, perfil, carregando, entrarComSenha, enviarLinkMagico, sair, recarregarPerfil }}
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
