import type { SupabaseClient } from "../supabase.js";
import type { Perfil } from "../types.js";

interface PerfilRow {
  id: string;
  igreja_id: string;
  nome: string;
  telefone: string | null;
  email: string;
  papel_global: string;
  ativo: boolean;
}

function mapPerfil(row: PerfilRow): Perfil {
  return {
    id: row.id,
    igrejaId: row.igreja_id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    papelGlobal: row.papel_global as Perfil["papelGlobal"],
    ativo: row.ativo,
  };
}

const COLUNAS_PERFIL = "id, igreja_id, nome, telefone, email, papel_global, ativo";

/**
 * Retorna o perfil do usuário logado, ou null se ele ainda não tiver um
 * (ainda não passou pelo onboarding / não foi convidado por um líder).
 */
export async function obterMeuPerfil(client: SupabaseClient): Promise<Perfil | null> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await client
    .from("perfis")
    .select(COLUNAS_PERFIL)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPerfil(data as PerfilRow) : null;
}

export async function listarPerfisDaIgreja(client: SupabaseClient, igrejaId: string): Promise<Perfil[]> {
  const { data, error } = await client
    .from("perfis")
    .select(COLUNAS_PERFIL)
    .eq("igreja_id", igrejaId)
    .eq("ativo", true)
    .order("nome");
  if (error) throw error;
  return (data as PerfilRow[]).map(mapPerfil);
}
