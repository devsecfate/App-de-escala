import type { SupabaseClient } from "../supabase.js";

/**
 * Cria a igreja e o perfil admin do usuário logado numa transação só
 * (RPC `criar_igreja` definida na migration de RLS). Só funciona para quem
 * ainda não tem perfil.
 */
export async function criarIgreja(
  client: SupabaseClient,
  nome: string,
  fusoHorario = "America/Sao_Paulo",
): Promise<string> {
  const { data, error } = await client.rpc("criar_igreja", {
    p_nome: nome,
    p_fuso_horario: fusoHorario,
  });
  if (error) throw error;
  return data as string;
}
