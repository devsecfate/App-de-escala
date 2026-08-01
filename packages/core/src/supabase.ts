import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Tipagem do schema do Postgres. Placeholder até rodar, contra um projeto
 * Supabase real:
 *
 *   npx supabase gen types typescript --local > packages/core/src/database.types.ts
 *
 * e trocar `Record<string, unknown>` abaixo por `Database` gerado.
 */
export type Database = Record<string, unknown>;

export function createSupabaseClient(url: string, anonKey: string): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error(
      "createSupabaseClient: url e anonKey são obrigatórios (verifique as variáveis de ambiente).",
    );
  }
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}

export type { SupabaseClient };
