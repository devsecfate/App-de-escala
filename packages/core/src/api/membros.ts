import type { SupabaseClient } from "../supabase.js";
import type { PapelMinisterio } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

export interface MembroMinisterioComPerfil {
  id: string; // id da linha em membros_ministerio
  ministerioId: string;
  perfilId: string;
  papel: PapelMinisterio;
  ativo: boolean;
  nome: string;
  email: string;
}

interface MembroRow {
  id: string;
  ministerio_id: string;
  perfil_id: string;
  papel: string;
  ativo: boolean;
  perfis: { nome: string; email: string } | { nome: string; email: string }[] | null;
}

function primeiroPerfil(perfis: MembroRow["perfis"]): { nome: string; email: string } | null {
  if (!perfis) return null;
  return Array.isArray(perfis) ? (perfis[0] ?? null) : perfis;
}

export async function listarMembrosDoMinisterio(
  client: SupabaseClient,
  ministerioId: string,
): Promise<MembroMinisterioComPerfil[]> {
  const { data, error } = await client
    .from("membros_ministerio")
    .select("id, ministerio_id, perfil_id, papel, ativo, perfis(nome, email)")
    .eq("ministerio_id", ministerioId)
    .eq("ativo", true);
  if (error) throw error;

  return (data as unknown as MembroRow[]).map((row) => {
    const perfil = primeiroPerfil(row.perfis);
    return {
      id: row.id,
      ministerioId: row.ministerio_id,
      perfilId: row.perfil_id,
      papel: row.papel as PapelMinisterio,
      ativo: row.ativo,
      nome: perfil?.nome ?? "(sem nome)",
      email: perfil?.email ?? "",
    };
  });
}

export async function definirPapelDoMembro(
  client: SupabaseClient,
  membroMinisterioId: string,
  papel: PapelMinisterio,
): Promise<void> {
  const { data, error } = await client
    .from("membros_ministerio")
    .update({ papel })
    .eq("id", membroMinisterioId)
    .select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("o papel desta pessoa"));
}

/**
 * Remoção lógica: marca o vínculo como inativo em vez de apagar (preserva
 * histórico de escalações).
 *
 * O banco recusa se for o último líder ativo do ministério (trigger
 * `membros_ministerio_protege_ultimo_lider`) — antes disso, o líder podia
 * remover a si mesmo e deixar o ministério sem ninguém capaz de montar escala,
 * nem de se readicionar, porque a policy de INSERT exige ser líder.
 */
export async function removerMembro(client: SupabaseClient, membroMinisterioId: string): Promise<void> {
  const { data, error } = await client
    .from("membros_ministerio")
    .update({ ativo: false })
    .eq("id", membroMinisterioId)
    .select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta pessoa"));
}

/** Adiciona ao ministério alguém que já tem perfil na igreja (já serve em outro ministério, por exemplo). */
export async function adicionarMembroExistente(
  client: SupabaseClient,
  ministerioId: string,
  perfilId: string,
  papel: PapelMinisterio = "membro",
): Promise<void> {
  const { error } = await client
    .from("membros_ministerio")
    .insert({ ministerio_id: ministerioId, perfil_id: perfilId, papel });
  if (error) throw error;
}

/** Ministérios (dessa igreja) em que o perfil informado é líder ativo. */
export async function listarMinisteriosLideradosPor(
  client: SupabaseClient,
  perfilId: string,
): Promise<{ ministerioId: string; ministerioNome: string }[]> {
  const { data, error } = await client
    .from("membros_ministerio")
    .select("ministerio_id, ministerios(nome)")
    .eq("perfil_id", perfilId)
    .eq("papel", "lider")
    .eq("ativo", true);
  if (error) throw error;

  return (data as unknown as { ministerio_id: string; ministerios: { nome: string } | { nome: string }[] | null }[]).map(
    (row) => {
      const ministerio = Array.isArray(row.ministerios) ? row.ministerios[0] : row.ministerios;
      return { ministerioId: row.ministerio_id, ministerioNome: ministerio?.nome ?? "" };
    },
  );
}
