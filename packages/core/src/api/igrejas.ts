import type { SupabaseClient } from "../supabase.js";
import type { Igreja } from "../types.js";

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

/**
 * Dados da igreja. O `fusoHorario` é o que define o que é "hoje" e "este mês"
 * para a igreja — não dá para confiar no fuso do aparelho de quem abriu a tela.
 */
export async function obterIgreja(client: SupabaseClient, igrejaId: string): Promise<Igreja | null> {
  const { data, error } = await client
    .from("igrejas")
    .select("id, nome, fuso_horario")
    .eq("id", igrejaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as { id: string; nome: string; fuso_horario: string };
  return { id: row.id, nome: row.nome, fusoHorario: row.fuso_horario };
}
