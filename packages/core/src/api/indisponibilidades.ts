import type { SupabaseClient } from "../supabase.js";
import type { Indisponibilidade } from "../types.js";

interface IndisponibilidadeRow {
  id: string;
  perfil_id: string;
  data_inicio: string;
  data_fim: string | null;
  motivo: string | null;
}

function mapIndisponibilidade(row: IndisponibilidadeRow): Indisponibilidade {
  return {
    id: row.id,
    perfilId: row.perfil_id,
    dataInicio: row.data_inicio,
    dataFim: row.data_fim,
    motivo: row.motivo,
  };
}

const COLUNAS_INDISPONIBILIDADE = "id, perfil_id, data_inicio, data_fim, motivo";

/** Indisponibilidades da pessoa, mais recentes primeiro. */
export async function listarIndisponibilidades(
  client: SupabaseClient,
  perfilId: string,
): Promise<Indisponibilidade[]> {
  const { data, error } = await client
    .from("indisponibilidades")
    .select(COLUNAS_INDISPONIBILIDADE)
    .eq("perfil_id", perfilId)
    .order("data_inicio", { ascending: false });
  if (error) throw error;
  return (data as IndisponibilidadeRow[]).map(mapIndisponibilidade);
}

export async function criarIndisponibilidade(
  client: SupabaseClient,
  perfilId: string,
  dataInicio: string,
  dataFim: string | null,
  motivo?: string,
): Promise<Indisponibilidade> {
  const { data, error } = await client
    .from("indisponibilidades")
    .insert({ perfil_id: perfilId, data_inicio: dataInicio, data_fim: dataFim, motivo: motivo ?? null })
    .select(COLUNAS_INDISPONIBILIDADE)
    .single();
  if (error) throw error;
  return mapIndisponibilidade(data as IndisponibilidadeRow);
}

export async function removerIndisponibilidade(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from("indisponibilidades").delete().eq("id", id);
  if (error) throw error;
}
