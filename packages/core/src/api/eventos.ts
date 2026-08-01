import type { SupabaseClient } from "../supabase.js";
import type { Evento } from "../types.js";

interface EventoRow {
  id: string;
  igreja_id: string;
  titulo: string;
  data_hora: string;
  tipo: string;
  observacoes: string | null;
}

function mapEvento(row: EventoRow): Evento {
  return {
    id: row.id,
    igrejaId: row.igreja_id,
    titulo: row.titulo,
    dataHora: row.data_hora,
    tipo: row.tipo,
    observacoes: row.observacoes,
  };
}

const COLUNAS_EVENTO = "id, igreja_id, titulo, data_hora, tipo, observacoes";

/** Eventos de hoje em diante, mais próximos primeiro. */
export async function listarProximosEventos(client: SupabaseClient, igrejaId: string): Promise<Evento[]> {
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);

  const { data, error } = await client
    .from("eventos")
    .select(COLUNAS_EVENTO)
    .eq("igreja_id", igrejaId)
    .gte("data_hora", inicioDeHoje.toISOString())
    .order("data_hora");
  if (error) throw error;
  return (data as EventoRow[]).map(mapEvento);
}

export async function obterEvento(client: SupabaseClient, id: string): Promise<Evento | null> {
  const { data, error } = await client.from("eventos").select(COLUNAS_EVENTO).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapEvento(data as EventoRow) : null;
}

export async function criarEvento(
  client: SupabaseClient,
  igrejaId: string,
  titulo: string,
  dataHoraIso: string,
  tipo = "culto",
  observacoes?: string,
): Promise<Evento> {
  const { data, error } = await client
    .from("eventos")
    .insert({ igreja_id: igrejaId, titulo, data_hora: dataHoraIso, tipo, observacoes: observacoes ?? null })
    .select(COLUNAS_EVENTO)
    .single();
  if (error) throw error;
  return mapEvento(data as EventoRow);
}
