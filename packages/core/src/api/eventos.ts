import type { SupabaseClient } from "../supabase.js";
import type { Evento } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

interface EventoRow {
  id: string;
  igreja_id: string;
  titulo: string;
  data_hora: string;
  tipo: string;
  observacoes: string | null;
  ativo: boolean;
}

function mapEvento(row: EventoRow): Evento {
  return {
    id: row.id,
    igrejaId: row.igreja_id,
    titulo: row.titulo,
    dataHora: row.data_hora,
    tipo: row.tipo,
    observacoes: row.observacoes,
    ativo: row.ativo,
  };
}

const COLUNAS_EVENTO = "id, igreja_id, titulo, data_hora, tipo, observacoes, ativo";

/** Eventos de hoje em diante, mais próximos primeiro. Arquivados ficam de fora. */
export async function listarProximosEventos(
  client: SupabaseClient,
  igrejaId: string,
  incluirArquivados = false,
): Promise<Evento[]> {
  const inicioDeHoje = new Date();
  inicioDeHoje.setHours(0, 0, 0, 0);

  let consulta = client
    .from("eventos")
    .select(COLUNAS_EVENTO)
    .eq("igreja_id", igrejaId)
    .gte("data_hora", inicioDeHoje.toISOString());

  if (!incluirArquivados) consulta = consulta.eq("ativo", true);

  const { data, error } = await consulta.order("data_hora");
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

export interface EventoInput {
  titulo: string;
  dataHoraIso: string;
  tipo?: string;
  observacoes?: string | null;
}

/**
 * Corrigir título, data/hora ou tipo. Errar a data do culto é o engano mais
 * comum de todos e até agora não tinha conserto: só criar outro e conviver com
 * o errado na lista.
 */
export async function atualizarEvento(
  client: SupabaseClient,
  eventoId: string,
  entrada: EventoInput,
): Promise<Evento> {
  const atualizacao: Record<string, unknown> = {
    titulo: entrada.titulo,
    data_hora: entrada.dataHoraIso,
  };
  if (entrada.tipo) atualizacao.tipo = entrada.tipo;
  if ("observacoes" in entrada) atualizacao.observacoes = entrada.observacoes ?? null;

  const { data, error } = await client
    .from("eventos")
    .update(atualizacao)
    .eq("id", eventoId)
    .select(COLUNAS_EVENTO);
  if (error) throw error;

  const linhas = (data ?? []) as EventoRow[];
  if (linhas.length === 0) throw new Error(semPermissao("este evento"));
  return mapEvento(linhas[0]!);
}

/** Arquiva (ou desarquiva) o evento — o caminho para evento que já tem escala. */
export async function definirEventoAtivo(
  client: SupabaseClient,
  eventoId: string,
  ativo: boolean,
): Promise<void> {
  const { data, error } = await client.from("eventos").update({ ativo }).eq("id", eventoId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("este evento"));
}

/**
 * Exclusão definitiva. Só para evento sem nenhuma escalação: a policy de
 * DELETE exige admin, e o cascade em `escalas` levaria junto a escala de todo
 * ministério que já tivesse montado a dele.
 */
export async function removerEvento(client: SupabaseClient, eventoId: string): Promise<void> {
  const { data, error } = await client.from("eventos").delete().eq("id", eventoId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("este evento"));
}

/**
 * Quantas escalações dependem deste evento, somando TODOS os ministérios.
 *
 * A soma completa é o ponto: quem lidera só o Louvor não enxerga, pela RLS, a
 * escala que a Recepção montou para o mesmo culto. Contando pelo cliente ele
 * leria zero e o app ofereceria excluir de vez — apagando o trabalho da
 * Recepção junto. Por isso a conta é uma RPC `security definer`.
 */
export async function contarEscalacoesDoEvento(client: SupabaseClient, eventoId: string): Promise<number> {
  const { data, error } = await client.rpc("contar_escalacoes_do_evento", { p_evento_id: eventoId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
