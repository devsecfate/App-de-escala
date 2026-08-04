import type { SupabaseClient } from "../supabase.js";
import type { Indisponibilidade } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

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

/** Corrigir as datas ou o motivo de um período já cadastrado. */
export async function atualizarIndisponibilidade(
  client: SupabaseClient,
  id: string,
  campos: { dataInicio?: string; dataFim?: string | null; motivo?: string | null },
): Promise<Indisponibilidade> {
  const atualizacao: Record<string, unknown> = {};
  if (typeof campos.dataInicio === "string") atualizacao.data_inicio = campos.dataInicio;
  if ("dataFim" in campos) atualizacao.data_fim = campos.dataFim ?? null;
  if ("motivo" in campos) atualizacao.motivo = campos.motivo ?? null;

  const { data, error } = await client
    .from("indisponibilidades")
    .update(atualizacao)
    .eq("id", id)
    .select(COLUNAS_INDISPONIBILIDADE);
  if (error) throw error;

  const linhas = (data ?? []) as IndisponibilidadeRow[];
  if (linhas.length === 0) throw new Error(semPermissao("este período"));
  return mapIndisponibilidade(linhas[0]!);
}

/** Aqui excluir de vez é o certo: nada no banco referencia indisponibilidade. */
export async function removerIndisponibilidade(client: SupabaseClient, id: string): Promise<void> {
  const { data, error } = await client.from("indisponibilidades").delete().eq("id", id).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("este período"));
}
