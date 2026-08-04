import type { SupabaseClient } from "../supabase.js";
import type { Funcao } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

interface FuncaoRow {
  id: string;
  ministerio_id: string;
  nome: string;
  obrigatoria: boolean;
  ativo: boolean;
}

function mapFuncao(row: FuncaoRow): Funcao {
  return {
    id: row.id,
    ministerioId: row.ministerio_id,
    nome: row.nome,
    obrigatoria: row.obrigatoria,
    ativo: row.ativo,
  };
}

const COLUNAS_FUNCAO = "id, ministerio_id, nome, obrigatoria, ativo";

export async function listarFuncoes(
  client: SupabaseClient,
  ministerioId: string,
  incluirArquivadas = false,
): Promise<Funcao[]> {
  let consulta = client.from("funcoes").select(COLUNAS_FUNCAO).eq("ministerio_id", ministerioId);
  if (!incluirArquivadas) consulta = consulta.eq("ativo", true);

  const { data, error } = await consulta.order("nome");
  if (error) throw error;
  return (data as FuncaoRow[]).map(mapFuncao);
}

export async function criarFuncao(
  client: SupabaseClient,
  ministerioId: string,
  nome: string,
  obrigatoria = false,
): Promise<Funcao> {
  const { data, error } = await client
    .from("funcoes")
    .insert({ ministerio_id: ministerioId, nome, obrigatoria })
    .select(COLUNAS_FUNCAO)
    .single();
  if (error) throw error;
  return mapFuncao(data as FuncaoRow);
}

/** Corrigir o nome ou a obrigatoriedade. Antes, errar o nome era para sempre. */
export async function atualizarFuncao(
  client: SupabaseClient,
  funcaoId: string,
  campos: { nome?: string; obrigatoria?: boolean },
): Promise<Funcao> {
  const atualizacao: Record<string, unknown> = {};
  if (typeof campos.nome === "string") atualizacao.nome = campos.nome;
  if (typeof campos.obrigatoria === "boolean") atualizacao.obrigatoria = campos.obrigatoria;

  const { data, error } = await client
    .from("funcoes")
    .update(atualizacao)
    .eq("id", funcaoId)
    .select(COLUNAS_FUNCAO);
  if (error) throw error;

  const linhas = (data ?? []) as FuncaoRow[];
  if (linhas.length === 0) throw new Error(semPermissao("esta função"));
  return mapFuncao(linhas[0]!);
}

/**
 * Arquiva (ou desarquiva) a função.
 *
 * Arquivar em vez de excluir importa aqui mais do que em qualquer outro lugar:
 * `escalacoes.funcao_id` é `on delete cascade`, então apagar "Guitarra"
 * apagaria silenciosamente todo mundo que serviu em guitarra nos últimos anos —
 * e o relatório de participação passaria a contar diferente do que contava
 * ontem, sem ninguém entender o porquê.
 */
export async function definirFuncaoAtiva(
  client: SupabaseClient,
  funcaoId: string,
  ativo: boolean,
): Promise<void> {
  const { data, error } = await client.from("funcoes").update({ ativo }).eq("id", funcaoId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta função"));
}

/** Exclusão definitiva — só para função que nunca foi usada em escala nenhuma. */
export async function removerFuncao(client: SupabaseClient, funcaoId: string): Promise<void> {
  const { data, error } = await client.from("funcoes").delete().eq("id", funcaoId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta função"));
}

/** Quantas escalações já usaram esta função (decide entre arquivar e excluir). */
export async function contarEscalacoesDaFuncao(client: SupabaseClient, funcaoId: string): Promise<number> {
  const { data, error } = await client.rpc("contar_escalacoes_da_funcao", { p_funcao_id: funcaoId });
  if (error) throw error;
  return (data as number | null) ?? 0;
}
