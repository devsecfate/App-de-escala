import type { SupabaseClient } from "../supabase.js";
import type { Perfil } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

interface PerfilRow {
  id: string;
  igreja_id: string;
  nome: string;
  telefone: string | null;
  email: string;
  papel_global: string;
  ativo: boolean;
}

function mapPerfil(row: PerfilRow): Perfil {
  return {
    id: row.id,
    igrejaId: row.igreja_id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    papelGlobal: row.papel_global as Perfil["papelGlobal"],
    ativo: row.ativo,
  };
}

const COLUNAS_PERFIL = "id, igreja_id, nome, telefone, email, papel_global, ativo";

/**
 * Retorna o perfil do usuário logado, ou null se ele ainda não tiver um
 * (ainda não passou pelo onboarding / não foi convidado por um líder).
 */
export async function obterMeuPerfil(client: SupabaseClient): Promise<Perfil | null> {
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await client
    .from("perfis")
    .select(COLUNAS_PERFIL)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPerfil(data as PerfilRow) : null;
}

export async function listarPerfisDaIgreja(
  client: SupabaseClient,
  igrejaId: string,
  incluirInativos = false,
): Promise<Perfil[]> {
  let consulta = client.from("perfis").select(COLUNAS_PERFIL).eq("igreja_id", igrejaId);
  if (!incluirInativos) consulta = consulta.eq("ativo", true);

  const { data, error } = await consulta.order("nome");
  if (error) throw error;
  return (data as PerfilRow[]).map(mapPerfil);
}

/**
 * Corrigir os próprios dados. Só nome, telefone e e-mail: `papel_global`,
 * `ativo` e `igreja_id` são barrados pelo trigger `perfis_restringe_update`
 * (RLS filtra linha, não coluna — sem o trigger qualquer pessoa viraria admin
 * da igreja mandando um PATCH na própria linha).
 */
export async function atualizarPerfil(
  client: SupabaseClient,
  perfilId: string,
  campos: { nome?: string; telefone?: string | null; email?: string },
): Promise<Perfil> {
  const atualizacao: Record<string, unknown> = {};
  if (typeof campos.nome === "string") atualizacao.nome = campos.nome;
  if ("telefone" in campos) atualizacao.telefone = campos.telefone ?? null;
  if (typeof campos.email === "string") atualizacao.email = campos.email;

  const { data, error } = await client
    .from("perfis")
    .update(atualizacao)
    .eq("id", perfilId)
    .select(COLUNAS_PERFIL);
  if (error) throw error;

  const linhas = (data ?? []) as PerfilRow[];
  if (linhas.length === 0) throw new Error(semPermissao("este perfil"));
  return mapPerfil(linhas[0]!);
}

/**
 * Desativa (ou reativa) alguém na igreja. Só admin: o trigger recusa quando
 * quem manda não é admin, então esta função existe para a tela do admin.
 *
 * Nunca excluir um perfil: `escalacoes.perfil_id` é cascade e apagar a pessoa
 * apagaria todo o histórico de quem serviu com ela.
 */
export async function definirPerfilAtivo(
  client: SupabaseClient,
  perfilId: string,
  ativo: boolean,
): Promise<void> {
  const { data, error } = await client.from("perfis").update({ ativo }).eq("id", perfilId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta pessoa"));
}
