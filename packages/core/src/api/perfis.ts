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

/** O que aconteceu com a conta ao ser excluída. */
export type ResultadoExclusaoConta = "excluida" | "arquivada";

/**
 * Quantas escalações e escalas dependem de mim.
 *
 * A tela de conta pergunta isto ANTES de confirmar, para dizer qual dos dois
 * desfechos vai acontecer — a mesma honestidade que `decidirExclusao` exige em
 * ministério, evento e função.
 */
export async function contarMeuHistorico(client: SupabaseClient): Promise<number> {
  const { data, error } = await client.rpc("contar_meu_historico");
  if (error) throw error;
  return (data as number | null) ?? 0;
}

/**
 * Exclui a própria conta. Em qualquer um dos dois casos a pessoa deixa de
 * conseguir entrar — o login é destruído no banco.
 *
 * - `"excluida"`: nunca serviu, então perfil, vínculos e login somem de vez (e
 *   a igreja também, se ela era a última pessoa lá dentro).
 * - `"arquivada"`: já serviu. O nome continua nas escalas passadas, porque é
 *   dele que o relatório de participação precisa; o resto (telefone, e-mail,
 *   vínculos, avisos no celular) é apagado.
 *
 * Recusa, com mensagem em português, quem é o único administrador da igreja ou
 * o único líder de um ministério que ainda tem outras pessoas.
 *
 * Depois de chamar, faça `signOut()`: a sessão do navegador continua em pé com
 * um token que já não corresponde a ninguém.
 */
export async function excluirMinhaConta(client: SupabaseClient): Promise<ResultadoExclusaoConta> {
  const { data, error } = await client.rpc("excluir_minha_conta");
  if (error) throw error;
  return data as ResultadoExclusaoConta;
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
