import type { SupabaseClient } from "../supabase.js";

/**
 * Cronograma do culto: as músicas da escala, em ordem. É o que liga o
 * repertório (Fase 4) à escala que o líder já montou.
 */
export interface ItemCronograma {
  id: string;
  escalaId: string;
  musicaId: string;
  ordem: number;
  /** tom escolhido para este culto; cai no tom padrão da música quando vazio */
  tomDoDia: string | null;
  /** momento do culto (ex: Abertura, Ceia) */
  momento: string | null;
  observacao: string | null;
  // vindos da música, para a tela não precisar cruzar na mão
  musicaTitulo: string;
  musicaTom: string | null;
  musicaLink: string | null;
}

interface ItemRow {
  id: string;
  escala_id: string;
  musica_id: string;
  ordem: number;
  tom_do_dia: string | null;
  momento: string | null;
  observacao: string | null;
  musicas: { titulo: string; tom: string | null; link: string | null } | null;
}

const COLUNAS_ITEM =
  "id, escala_id, musica_id, ordem, tom_do_dia, momento, observacao, musicas(titulo, tom, link)";

function mapItem(row: ItemRow): ItemCronograma {
  return {
    id: row.id,
    escalaId: row.escala_id,
    musicaId: row.musica_id,
    ordem: row.ordem,
    tomDoDia: row.tom_do_dia,
    momento: row.momento,
    observacao: row.observacao,
    musicaTitulo: row.musicas?.titulo ?? "(música removida)",
    musicaTom: row.musicas?.tom ?? null,
    musicaLink: row.musicas?.link ?? null,
  };
}

export async function listarCronograma(
  client: SupabaseClient,
  escalaId: string,
): Promise<ItemCronograma[]> {
  const { data, error } = await client
    .from("cronograma_itens")
    .select(COLUNAS_ITEM)
    .eq("escala_id", escalaId)
    .order("ordem");
  if (error) throw error;
  return (data as unknown as ItemRow[]).map(mapItem);
}

export interface ItemCronogramaInput {
  musicaId: string;
  ordem: number;
  tomDoDia?: string | null;
  momento?: string | null;
  observacao?: string | null;
}

export async function adicionarItemCronograma(
  client: SupabaseClient,
  escalaId: string,
  entrada: ItemCronogramaInput,
): Promise<void> {
  const { error } = await client.from("cronograma_itens").insert({
    escala_id: escalaId,
    musica_id: entrada.musicaId,
    ordem: entrada.ordem,
    tom_do_dia: entrada.tomDoDia ?? null,
    momento: entrada.momento ?? null,
    observacao: entrada.observacao ?? null,
  });
  if (error) throw error;
}

export async function atualizarItemCronograma(
  client: SupabaseClient,
  itemId: string,
  campos: { tomDoDia?: string | null; momento?: string | null; observacao?: string | null },
): Promise<void> {
  const atualizacao: Record<string, string | null> = {};
  if ("tomDoDia" in campos) atualizacao.tom_do_dia = campos.tomDoDia ?? null;
  if ("momento" in campos) atualizacao.momento = campos.momento ?? null;
  if ("observacao" in campos) atualizacao.observacao = campos.observacao ?? null;

  const { error } = await client.from("cronograma_itens").update(atualizacao).eq("id", itemId);
  if (error) throw error;
}

export async function removerItemCronograma(client: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await client.from("cronograma_itens").delete().eq("id", itemId);
  if (error) throw error;
}

/**
 * Grava a nova ordem depois de o líder mover um item. Recebe os ids já na
 * ordem desejada (ver `moverItem` em cronograma-ordem.ts).
 */
export async function salvarOrdemCronograma(
  client: SupabaseClient,
  idsNaOrdem: string[],
): Promise<void> {
  for (const [indice, id] of idsNaOrdem.entries()) {
    const { error } = await client.from("cronograma_itens").update({ ordem: indice }).eq("id", id);
    if (error) throw error;
  }
}
