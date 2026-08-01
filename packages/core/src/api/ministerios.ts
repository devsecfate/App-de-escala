import type { SupabaseClient } from "../supabase.js";
import type { Ministerio } from "../types.js";

interface MinisterioRow {
  id: string;
  igreja_id: string;
  nome: string;
  descricao: string | null;
  ordem: number;
  ativo: boolean;
}

function mapMinisterio(row: MinisterioRow): Ministerio {
  return {
    id: row.id,
    igrejaId: row.igreja_id,
    nome: row.nome,
    descricao: row.descricao,
    ordem: row.ordem,
    ativo: row.ativo,
  };
}

const COLUNAS_MINISTERIO = "id, igreja_id, nome, descricao, ordem, ativo";

export async function listarMinisterios(client: SupabaseClient, igrejaId: string): Promise<Ministerio[]> {
  const { data, error } = await client
    .from("ministerios")
    .select(COLUNAS_MINISTERIO)
    .eq("igreja_id", igrejaId)
    .eq("ativo", true)
    .order("ordem");
  if (error) throw error;
  return (data as MinisterioRow[]).map(mapMinisterio);
}

export async function obterMinisterio(client: SupabaseClient, id: string): Promise<Ministerio | null> {
  const { data, error } = await client
    .from("ministerios")
    .select(COLUNAS_MINISTERIO)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapMinisterio(data as MinisterioRow) : null;
}

export async function criarMinisterio(
  client: SupabaseClient,
  igrejaId: string,
  nome: string,
  descricao?: string,
): Promise<Ministerio> {
  const { data, error } = await client
    .from("ministerios")
    .insert({ igreja_id: igrejaId, nome, descricao: descricao ?? null })
    .select(COLUNAS_MINISTERIO)
    .single();
  if (error) throw error;
  return mapMinisterio(data as MinisterioRow);
}
