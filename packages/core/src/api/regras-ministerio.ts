import type { SupabaseClient } from "../supabase.js";
import type { RegraMinisterio } from "../types.js";

interface RegraMinisterioRow {
  id: string;
  ministerio_id: string;
  max_escalas_mes: number | null;
  intervalo_min_dias: number | null;
  bloquear_conflito_evento: boolean;
}

function mapRegraMinisterio(row: RegraMinisterioRow): RegraMinisterio {
  return {
    id: row.id,
    ministerioId: row.ministerio_id,
    maxEscalasMes: row.max_escalas_mes,
    intervaloMinDias: row.intervalo_min_dias,
    bloquearConflitoEvento: row.bloquear_conflito_evento,
  };
}

const COLUNAS_REGRA_MINISTERIO = "id, ministerio_id, max_escalas_mes, intervalo_min_dias, bloquear_conflito_evento";

/** Regras do ministério, ou null se o líder ainda não configurou nenhuma. */
export async function obterRegrasMinisterio(
  client: SupabaseClient,
  ministerioId: string,
): Promise<RegraMinisterio | null> {
  const { data, error } = await client
    .from("regras_ministerio")
    .select(COLUNAS_REGRA_MINISTERIO)
    .eq("ministerio_id", ministerioId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapRegraMinisterio(data as RegraMinisterioRow) : null;
}

export interface RegrasMinisterioInput {
  maxEscalasMes: number | null;
  intervaloMinDias: number | null;
  bloquearConflitoEvento: boolean;
}

/** Cria ou atualiza as regras do ministério (ministerio_id é único na tabela). */
export async function salvarRegrasMinisterio(
  client: SupabaseClient,
  ministerioId: string,
  regras: RegrasMinisterioInput,
): Promise<RegraMinisterio> {
  const { data, error } = await client
    .from("regras_ministerio")
    .upsert(
      {
        ministerio_id: ministerioId,
        max_escalas_mes: regras.maxEscalasMes,
        intervalo_min_dias: regras.intervaloMinDias,
        bloquear_conflito_evento: regras.bloquearConflitoEvento,
      },
      { onConflict: "ministerio_id" },
    )
    .select(COLUNAS_REGRA_MINISTERIO)
    .single();
  if (error) throw error;
  return mapRegraMinisterio(data as RegraMinisterioRow);
}
