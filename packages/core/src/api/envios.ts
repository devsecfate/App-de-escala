import type { SupabaseClient } from "../supabase.js";

export type CanalEnvio = "whatsapp" | "push";
export type StatusEnvio = "pendente" | "enviado" | "falhou";

export interface Envio {
  id: string;
  escalaId: string;
  canal: CanalEnvio;
  status: StatusEnvio;
  enviadoEm: string | null;
}

interface EnvioRow {
  id: string;
  escala_id: string;
  canal: string;
  status: string;
  enviado_em: string | null;
}

function mapEnvio(row: EnvioRow): Envio {
  return {
    id: row.id,
    escalaId: row.escala_id,
    canal: row.canal as CanalEnvio,
    status: row.status as StatusEnvio,
    enviadoEm: row.enviado_em,
  };
}

const COLUNAS_ENVIO = "id, escala_id, canal, status, enviado_em";

/**
 * Registra que a escala foi compartilhada. No WhatsApp da Fase 3 quem envia de
 * fato é o líder, no app dele — aqui guardamos só o histórico de que saiu.
 */
export async function registrarEnvio(
  client: SupabaseClient,
  escalaId: string,
  canal: CanalEnvio = "whatsapp",
): Promise<Envio> {
  const { data, error } = await client
    .from("envios")
    .insert({ escala_id: escalaId, canal, status: "enviado", enviado_em: new Date().toISOString() })
    .select(COLUNAS_ENVIO)
    .single();
  if (error) throw error;
  return mapEnvio(data as EnvioRow);
}

/** Último compartilhamento da escala, para o líder saber se já mandou. */
export async function obterUltimoEnvio(client: SupabaseClient, escalaId: string): Promise<Envio | null> {
  const { data, error } = await client
    .from("envios")
    .select(COLUNAS_ENVIO)
    .eq("escala_id", escalaId)
    .eq("status", "enviado")
    .order("enviado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapEnvio(data as EnvioRow) : null;
}
