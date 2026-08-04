import type { SupabaseClient } from "../supabase.js";
import type { Ministerio } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

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

/**
 * Ministérios da igreja. Por padrão só os ativos — os arquivados continuam no
 * banco (o histórico de escalas depende deles) mas somem das listas do dia a
 * dia. Passe `incluirArquivados` na tela que oferece desarquivar.
 */
export async function listarMinisterios(
  client: SupabaseClient,
  igrejaId: string,
  incluirArquivados = false,
): Promise<Ministerio[]> {
  let consulta = client.from("ministerios").select(COLUNAS_MINISTERIO).eq("igreja_id", igrejaId);
  if (!incluirArquivados) consulta = consulta.eq("ativo", true);

  const { data, error } = await consulta.order("ordem");
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

/**
 * Quantas pessoas ativas há em cada ministério, numa consulta só.
 *
 * A lista de ministérios mostrava apenas o nome — nada dizia se o ministério
 * tem 2 ou 20 pessoas, que é a primeira coisa que o admin quer saber ao abrir
 * a tela.
 */
export async function contarMembrosPorMinisterio(
  client: SupabaseClient,
  ministerioIds: string[],
): Promise<Map<string, number>> {
  const contagem = new Map<string, number>();
  if (ministerioIds.length === 0) return contagem;

  const { data, error } = await client
    .from("membros_ministerio")
    .select("ministerio_id")
    .in("ministerio_id", ministerioIds)
    .eq("ativo", true);
  if (error) throw error;

  for (const linha of (data ?? []) as { ministerio_id: string }[]) {
    contagem.set(linha.ministerio_id, (contagem.get(linha.ministerio_id) ?? 0) + 1);
  }
  return contagem;
}

export interface MinisterioInput {
  nome: string;
  descricao?: string | null;
  ordem?: number;
}

export async function atualizarMinisterio(
  client: SupabaseClient,
  ministerioId: string,
  entrada: MinisterioInput,
): Promise<Ministerio> {
  const atualizacao: Record<string, unknown> = { nome: entrada.nome };
  if ("descricao" in entrada) atualizacao.descricao = entrada.descricao ?? null;
  if (typeof entrada.ordem === "number") atualizacao.ordem = entrada.ordem;

  const { data, error } = await client
    .from("ministerios")
    .update(atualizacao)
    .eq("id", ministerioId)
    .select(COLUNAS_MINISTERIO);
  if (error) throw error;

  const linhas = (data ?? []) as MinisterioRow[];
  if (linhas.length === 0) throw new Error(semPermissao("este ministério"));
  return mapMinisterio(linhas[0]!);
}

/**
 * Arquiva (ou desarquiva) o ministério. É o caminho para todo ministério que
 * já foi usado: `ministerios` tem sete chaves estrangeiras em cascade e apagar
 * levaria junto escalas, escalações e cronogramas de anos — mudando o
 * relatório de participação retroativamente.
 */
export async function definirMinisterioAtivo(
  client: SupabaseClient,
  ministerioId: string,
  ativo: boolean,
): Promise<void> {
  const { data, error } = await client
    .from("ministerios")
    .update({ ativo })
    .eq("id", ministerioId)
    .select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("este ministério"));
}

/**
 * Exclusão definitiva. Só chame depois de `contarEscalacoesDoMinisterio`
 * devolver zero — com histórico, o certo é `definirMinisterioAtivo(false)`.
 */
export async function removerMinisterio(client: SupabaseClient, ministerioId: string): Promise<void> {
  const { data, error } = await client.from("ministerios").delete().eq("id", ministerioId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("este ministério"));
}

/**
 * Quantas escalações já existem neste ministério — é o que decide entre
 * arquivar e excluir.
 *
 * Vem de uma RPC `security definer` de propósito: a policy de `escalacoes` só
 * mostra as do ministério que a pessoa lidera, então contar pelo cliente
 * devolveria zero para quem não lidera e o app ofereceria "excluir de vez" um
 * ministério cheio de histórico.
 */
export async function contarEscalacoesDoMinisterio(
  client: SupabaseClient,
  ministerioId: string,
): Promise<number> {
  const { data, error } = await client.rpc("contar_escalacoes_do_ministerio", {
    p_ministerio_id: ministerioId,
  });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
