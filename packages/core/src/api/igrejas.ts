import type { SupabaseClient } from "../supabase.js";
import type { Igreja } from "../types.js";
import { semPermissao } from "./linhas.js";

/**
 * Cria a igreja e o perfil admin do usuário logado numa transação só
 * (RPC `criar_igreja` definida na migration de RLS). Só funciona para quem
 * ainda não tem perfil.
 */
export async function criarIgreja(
  client: SupabaseClient,
  nome: string,
  fusoHorario = "America/Sao_Paulo",
  /**
   * Nome de quem está criando. Quem entrou por link mágico não tem nome
   * nenhum guardado no `user_metadata`, e sem isto o perfil do admin nasceria
   * com o e-mail no lugar do nome.
   */
  nomeResponsavel?: string,
): Promise<string> {
  const { data, error } = await client.rpc("criar_igreja", {
    p_nome: nome,
    p_fuso_horario: fusoHorario,
    p_nome_responsavel: nomeResponsavel ?? null,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Dados da igreja. O `fusoHorario` é o que define o que é "hoje" e "este mês"
 * para a igreja — não dá para confiar no fuso do aparelho de quem abriu a tela.
 */
export async function obterIgreja(client: SupabaseClient, igrejaId: string): Promise<Igreja | null> {
  const { data, error } = await client
    .from("igrejas")
    .select("id, nome, fuso_horario")
    .eq("id", igrejaId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as { id: string; nome: string; fuso_horario: string };
  return { id: row.id, nome: row.nome, fusoHorario: row.fuso_horario };
}

/**
 * Corrigir nome e fuso da igreja (só admin, pela policy `igrejas_update`).
 *
 * O fuso não é detalhe: ele decide o que é "amanhã" para o lembrete de véspera
 * e o que é "este mês" para o relatório de participação. Até agora era chumbado
 * no onboarding e não tinha conserto — quem escolhesse errado ficava com o
 * relatório torto para sempre.
 */
export async function atualizarIgreja(
  client: SupabaseClient,
  igrejaId: string,
  campos: { nome?: string; fusoHorario?: string },
): Promise<Igreja> {
  const atualizacao: Record<string, unknown> = {};
  if (typeof campos.nome === "string") atualizacao.nome = campos.nome;
  if (typeof campos.fusoHorario === "string") atualizacao.fuso_horario = campos.fusoHorario;

  const { data, error } = await client
    .from("igrejas")
    .update(atualizacao)
    .eq("id", igrejaId)
    .select("id, nome, fuso_horario");
  if (error) throw error;

  const linhas = (data ?? []) as { id: string; nome: string; fuso_horario: string }[];
  if (linhas.length === 0) throw new Error(semPermissao("os dados da igreja"));
  const linha = linhas[0]!;
  return { id: linha.id, nome: linha.nome, fusoHorario: linha.fuso_horario };
}
