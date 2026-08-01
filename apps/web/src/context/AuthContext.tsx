import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextValue {
  session: Session | null;
  carregando: boolean;
  entrarComSenha: (email: string, senha: string) => Promise<{ erro: string | null }>;
  enviarLinkMagico: (email: string) => Promise<{ erro: string | null }>;
  sair: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_evento, novaSession) => {
      setSession(novaSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

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

  return (
    <AuthContext.Provider value={{ session, carregando, entrarComSenha, enviarLinkMagico, sair }}>
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
