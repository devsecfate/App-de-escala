import type { SupabaseClient } from "../supabase.js";
import type { Convite, PapelMinisterio } from "../types.js";
import { linkWhatsApp } from "../texto-escala.js";

interface ConviteRow {
  id: string;
  igreja_id: string;
  ministerio_id: string | null;
  codigo: string;
  nome_sugerido: string | null;
  papel: string;
  usos_max: number;
  usos: number;
  expira_em: string;
  cancelado_em: string | null;
  criado_por: string | null;
  created_at: string;
}

function mapConvite(row: ConviteRow): Convite {
  return {
    id: row.id,
    igrejaId: row.igreja_id,
    ministerioId: row.ministerio_id,
    codigo: row.codigo,
    nomeSugerido: row.nome_sugerido,
    papel: row.papel as PapelMinisterio,
    usosMax: row.usos_max,
    usos: row.usos,
    expiraEm: row.expira_em,
    canceladoEm: row.cancelado_em,
    criadoPor: row.criado_por,
    criadoEm: row.created_at,
  };
}

const COLUNAS_CONVITE =
  "id, igreja_id, ministerio_id, codigo, nome_sugerido, papel, usos_max, usos, expira_em, cancelado_em, criado_por, created_at";

export interface NovoConvite {
  /** null/ausente = convite só para a igreja (exige ser admin). */
  ministerioId?: string | null;
  papel?: PapelMinisterio;
  /** Nome que aparece pré-preenchido se a pessoa não informar o dela. */
  nomeSugerido?: string | null;
  /** Quantas pessoas podem usar o mesmo código (1 a 100). */
  usosMax?: number;
  /** 1 a 90 dias. */
  validoPorDias?: number;
}

/**
 * Gera o código. Quem valida permissão, igreja e autoria é a RPC
 * `criar_convite` (security definer) — mandar `igreja_id` daqui seria
 * confiar no cliente para dizer de qual igreja ele é.
 */
export async function criarConvite(client: SupabaseClient, opcoes: NovoConvite = {}): Promise<Convite> {
  const { data, error } = await client.rpc("criar_convite", {
    p_ministerio_id: opcoes.ministerioId ?? null,
    p_papel: opcoes.papel ?? "membro",
    p_nome_sugerido: opcoes.nomeSugerido ?? null,
    p_usos_max: opcoes.usosMax ?? 1,
    p_valido_por_dias: opcoes.validoPorDias ?? 7,
  });
  if (error) throw error;
  return mapConvite(data as ConviteRow);
}

/** Convites que o usuário logado pode ver; sem `ministerioId`, os da igreja toda. */
export async function listarConvites(
  client: SupabaseClient,
  ministerioId?: string,
): Promise<Convite[]> {
  let consulta = client.from("convites").select(COLUNAS_CONVITE).order("created_at", { ascending: false });
  if (ministerioId) {
    consulta = consulta.eq("ministerio_id", ministerioId);
  }

  const { data, error } = await consulta;
  if (error) throw error;
  return (data as ConviteRow[]).map(mapConvite);
}

/**
 * Cancela o convite (não apaga: o líder precisa continuar vendo quem entrou
 * por qual código).
 *
 * O `.select("id")` não é enfeite: quando a RLS filtra a linha, o PostgREST
 * responde sucesso com zero linhas alteradas, e sem esta checagem o botão
 * "funcionaria" enquanto o convite continua valendo.
 */
export async function cancelarConvite(client: SupabaseClient, conviteId: string): Promise<void> {
  const { data, error } = await client
    .from("convites")
    .update({ cancelado_em: new Date().toISOString() })
    .eq("id", conviteId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Não foi possível cancelar este convite (sem permissão ou já removido).");
  }
}

/**
 * Usa o código e cria o perfil de quem acabou de entrar. Devolve o id da
 * igreja. Erros vêm em português direto do banco ("Este convite venceu...").
 */
export async function usarConvite(client: SupabaseClient, codigo: string): Promise<string> {
  const { data, error } = await client.rpc("usar_convite", { p_codigo: codigo });
  if (error) throw error;
  return data as string;
}

/** "ABCD-2345" — o hífen é só para leitura; `usar_convite` ignora a pontuação. */
export function formatarCodigoConvite(codigo: string): string {
  const limpo = normalizarCodigoConvite(codigo);
  return limpo.length === 8 ? `${limpo.slice(0, 4)}-${limpo.slice(4)}` : limpo;
}

/** Tira hífen, espaço e acentua caixa — o mesmo que a RPC faz do lado do banco. */
export function normalizarCodigoConvite(codigo: string): string {
  return codigo.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function conviteAtivo(convite: Convite, agora = new Date()): boolean {
  return (
    convite.canceladoEm === null &&
    convite.usos < convite.usosMax &&
    new Date(convite.expiraEm).getTime() > agora.getTime()
  );
}

export interface ContextoConviteTexto {
  igrejaNome?: string;
  ministerioNome?: string;
}

/**
 * Mensagem pronta para o líder colar no WhatsApp. Mesma marcação de
 * `texto-escala.ts`: *negrito* e _itálico_.
 *
 * O link já leva o código na URL (`?convite=`), então quem clica não digita
 * nada — mas o código aparece escrito também, porque link encurtado por app de
 * mensagem some, e aí digitar é o único caminho.
 */
export function textoConviteWhatsApp(
  convite: Convite,
  urlDoApp: string,
  contexto: ContextoConviteTexto = {},
): string {
  const onde = [contexto.ministerioNome, contexto.igrejaNome].filter(Boolean).join(" · ");
  const codigo = formatarCodigoConvite(convite.codigo);
  const validade = new Date(convite.expiraEm).toLocaleDateString("pt-BR");
  const base = urlDoApp.replace(/\/+$/, "");

  const linhas = [
    onde ? `*Convite — ${onde}*` : "*Convite para o App de Escala*",
    "",
    "Crie sua conta no app e use este código para entrar:",
    `*${codigo}*`,
    "",
    `${base}/cadastrar?convite=${normalizarCodigoConvite(convite.codigo)}`,
    "",
    `_Válido até ${validade}._`,
  ];

  return linhas.join("\n");
}

/** Link do WhatsApp já com a mensagem do convite. */
export function linkConviteWhatsApp(
  convite: Convite,
  urlDoApp: string,
  contexto: ContextoConviteTexto = {},
): string {
  return linkWhatsApp(textoConviteWhatsApp(convite, urlDoApp, contexto));
}
