import type { SupabaseClient } from "../supabase.js";
import type { Funcao } from "../types.js";

interface FuncaoRow {
  id: string;
  ministerio_id: string;
  nome: string;
  obrigatoria: boolean;
}

function mapFuncao(row: FuncaoRow): Funcao {
  return { id: row.id, ministerioId: row.ministerio_id, nome: row.nome, obrigatoria: row.obrigatoria };
}

const COLUNAS_FUNCAO = "id, ministerio_id, nome, obrigatoria";

export async function listarFuncoes(client: SupabaseClient, ministerioId: string): Promise<Funcao[]> {
  const { data, error } = await client
    .from("funcoes")
    .select(COLUNAS_FUNCAO)
    .eq("ministerio_id", ministerioId)
    .order("nome");
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
