import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Apoio da suíte de integração. Aponta para o Supabase local (`npx supabase start`)
 * e usa os usuários criados por `supabase/seed.sql`.
 *
 * A chave anônima abaixo é a de demonstração que o Supabase CLI usa em toda
 * instalação local — é pública por definição e não vale nada fora da máquina.
 */
export const URL_SUPABASE = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
export const CHAVE_ANON =
  process.env.SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export const SENHA_SEED = "senha123";

export const USUARIOS = {
  admin: "admin@igreja.test",
  liderLouvor: "lider.louvor@igreja.test",
  liderTecnologia: "lider.tecnologia@igreja.test",
  vocal1: "vocal1@igreja.test",
  projecao1: "projecao1@igreja.test",
} as const;

/** Cliente autenticado como um dos usuários do seed. */
export async function entrarComo(email: string): Promise<SupabaseClient> {
  const client = createClient(URL_SUPABASE, CHAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password: SENHA_SEED });
  if (error) {
    throw new Error(
      `Não foi possível entrar como ${email}: ${error.message}. ` +
        "A suíte de integração precisa de `npx supabase start` com o seed aplicado.",
    );
  }
  return client;
}

/** Id do ministério pelo nome, dentro da igreja do usuário logado. */
export async function idDoMinisterio(client: SupabaseClient, nome: string): Promise<string> {
  const { data, error } = await client.from("ministerios").select("id").eq("nome", nome).single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function idDoPerfil(client: SupabaseClient, email: string): Promise<string> {
  const { data, error } = await client.from("perfis").select("id").eq("email", email).single();
  if (error) throw error;
  return (data as { id: string }).id;
}
