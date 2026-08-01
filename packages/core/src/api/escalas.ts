import type { SupabaseClient } from "../supabase.js";
import type { Escala, StatusEscala } from "../types.js";

interface EscalaRow {
  id: string;
  evento_id: string;
  ministerio_id: string;
  status: string;
  publicada_em: string | null;
  criada_por: string;
}

function mapEscala(row: EscalaRow): Escala {
  return {
    id: row.id,
    eventoId: row.evento_id,
    ministerioId: row.ministerio_id,
    status: row.status as StatusEscala,
    publicadaEm: row.publicada_em,
    criadaPor: row.criada_por,
  };
}

const COLUNAS_ESCALA = "id, evento_id, ministerio_id, status, publicada_em, criada_por";

/**
 * Busca a escala do ministério para o evento; cria como rascunho se ainda
 * não existir (evento_id + ministerio_id é único no banco).
 */
export async function obterOuCriarEscala(
  client: SupabaseClient,
  eventoId: string,
  ministerioId: string,
  criadaPor: string,
): Promise<Escala> {
  const existente = await client
    .from("escalas")
    .select(COLUNAS_ESCALA)
    .eq("evento_id", eventoId)
    .eq("ministerio_id", ministerioId)
    .maybeSingle();
  if (existente.error) throw existente.error;
  if (existente.data) return mapEscala(existente.data as EscalaRow);

  const criada = await client
    .from("escalas")
    .insert({ evento_id: eventoId, ministerio_id: ministerioId, criada_por: criadaPor })
    .select(COLUNAS_ESCALA)
    .single();
  if (criada.error) throw criada.error;
  return mapEscala(criada.data as EscalaRow);
}

export interface EscalacaoDaFuncao {
  funcaoId: string;
  funcaoNome: string;
  obrigatoria: boolean;
  escalacaoId: string | null;
  perfilId: string | null;
  perfilNome: string | null;
  confirmacao: string | null;
}

interface FuncaoRow {
  id: string;
  nome: string;
  obrigatoria: boolean;
}

interface EscalacaoRow {
  id: string;
  funcao_id: string;
  perfil_id: string;
  confirmacao: string;
  perfis: { nome: string } | { nome: string }[] | null;
}

/** Uma linha por função do ministério, com quem (se alguém) está escalado nela. */
export async function listarEscalacoesPorFuncao(
  client: SupabaseClient,
  escalaId: string,
  ministerioId: string,
): Promise<EscalacaoDaFuncao[]> {
  const funcoesRes = await client
    .from("funcoes")
    .select("id, nome, obrigatoria")
    .eq("ministerio_id", ministerioId)
    .order("nome");
  if (funcoesRes.error) throw funcoesRes.error;

  const escalacoesRes = await client
    .from("escalacoes")
    .select("id, funcao_id, perfil_id, confirmacao, perfis(nome)")
    .eq("escala_id", escalaId);
  if (escalacoesRes.error) throw escalacoesRes.error;

  const porFuncao = new Map<string, EscalacaoRow>();
  for (const linha of (escalacoesRes.data ?? []) as unknown as EscalacaoRow[]) {
    porFuncao.set(linha.funcao_id, linha);
  }

  return ((funcoesRes.data ?? []) as FuncaoRow[]).map((funcao) => {
    const escalacao = porFuncao.get(funcao.id);
    const perfil = escalacao
      ? Array.isArray(escalacao.perfis)
        ? (escalacao.perfis[0] ?? null)
        : escalacao.perfis
      : null;
    return {
      funcaoId: funcao.id,
      funcaoNome: funcao.nome,
      obrigatoria: funcao.obrigatoria,
      escalacaoId: escalacao?.id ?? null,
      perfilId: escalacao?.perfil_id ?? null,
      perfilNome: perfil?.nome ?? null,
      confirmacao: escalacao?.confirmacao ?? null,
    };
  });
}

/**
 * Define quem ocupa uma função da escala (substitui quem estava, se houver).
 * Passe perfilId = null para esvaziar a função.
 */
export async function definirEscalacao(
  client: SupabaseClient,
  escalaId: string,
  funcaoId: string,
  perfilId: string | null,
): Promise<void> {
  const remocao = await client.from("escalacoes").delete().eq("escala_id", escalaId).eq("funcao_id", funcaoId);
  if (remocao.error) throw remocao.error;

  if (perfilId) {
    const insercao = await client
      .from("escalacoes")
      .insert({ escala_id: escalaId, funcao_id: funcaoId, perfil_id: perfilId });
    if (insercao.error) throw insercao.error;
  }
}

export async function publicarEscala(client: SupabaseClient, escalaId: string): Promise<void> {
  const { error } = await client
    .from("escalas")
    .update({ status: "publicada", publicada_em: new Date().toISOString() })
    .eq("id", escalaId);
  if (error) throw error;
}

export interface MinhaEscalacao {
  escalacaoId: string;
  eventoTitulo: string;
  dataHora: string;
  ministerioNome: string;
  funcaoNome: string;
  confirmacao: string;
}

interface MinhaEscalacaoRow {
  id: string;
  confirmacao: string;
  funcoes: { nome: string } | { nome: string }[] | null;
  escalas:
    | {
        status: string;
        eventos: { titulo: string; data_hora: string } | { titulo: string; data_hora: string }[] | null;
        ministerios: { nome: string } | { nome: string }[] | null;
      }
    | {
        status: string;
        eventos: { titulo: string; data_hora: string } | { titulo: string; data_hora: string }[] | null;
        ministerios: { nome: string } | { nome: string }[] | null;
      }[]
    | null;
}

function primeiro<T>(valor: T | T[] | null): T | null {
  if (!valor) return null;
  return Array.isArray(valor) ? (valor[0] ?? null) : valor;
}

/** Escalações publicadas da pessoa, das mais próximas para as mais distantes. */
export async function listarMinhasEscalacoes(client: SupabaseClient, perfilId: string): Promise<MinhaEscalacao[]> {
  const { data, error } = await client
    .from("escalacoes")
    .select(
      "id, confirmacao, funcoes(nome), escalas!inner(status, eventos(titulo, data_hora), ministerios(nome))",
    )
    .eq("perfil_id", perfilId)
    .eq("escalas.status", "publicada");
  if (error) throw error;

  const resultado = ((data ?? []) as unknown as MinhaEscalacaoRow[]).map((linha) => {
    const escala = primeiro(linha.escalas);
    const evento = primeiro(escala?.eventos ?? null);
    const ministerio = primeiro(escala?.ministerios ?? null);
    const funcao = primeiro(linha.funcoes);
    return {
      escalacaoId: linha.id,
      eventoTitulo: evento?.titulo ?? "",
      dataHora: evento?.data_hora ?? "",
      ministerioNome: ministerio?.nome ?? "",
      funcaoNome: funcao?.nome ?? "",
      confirmacao: linha.confirmacao,
    };
  });

  return resultado.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
}
