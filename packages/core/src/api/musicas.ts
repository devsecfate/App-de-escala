import type { SupabaseClient } from "../supabase.js";
import type { CampoMusica, CategoriaMusica, Musica } from "../types.js";

// ---------------------------------------------------------------------------
// Músicas
// ---------------------------------------------------------------------------

interface MusicaRow {
  id: string;
  ministerio_id: string;
  titulo: string;
  artista: string | null;
  tom: string | null;
  andamento: string | null;
  categoria: string | null;
  link: string | null;
  ativa: boolean;
  extras: Record<string, unknown> | null;
}

function mapMusica(row: MusicaRow): Musica {
  return {
    id: row.id,
    ministerioId: row.ministerio_id,
    titulo: row.titulo,
    artista: row.artista,
    tom: row.tom,
    andamento: row.andamento,
    categoria: row.categoria,
    link: row.link,
    ativa: row.ativa,
    extras: row.extras ?? {},
  };
}

const COLUNAS_MUSICA =
  "id, ministerio_id, titulo, artista, tom, andamento, categoria, link, ativa, extras";

/**
 * Repertório do ministério. Por padrão só o que está em uso — `louvores.md`
 * pede que música fora de uso vire histórico em vez de sumir, então quem quiser
 * o "repertório antigo" passa `incluirInativas`.
 */
export async function listarMusicas(
  client: SupabaseClient,
  ministerioId: string,
  incluirInativas = false,
): Promise<Musica[]> {
  let consulta = client
    .from("musicas")
    .select(COLUNAS_MUSICA)
    .eq("ministerio_id", ministerioId);

  if (!incluirInativas) consulta = consulta.eq("ativa", true);

  const { data, error } = await consulta.order("titulo");
  if (error) throw error;
  return (data as MusicaRow[]).map(mapMusica);
}

export interface MusicaInput {
  titulo: string;
  artista?: string | null;
  tom?: string | null;
  andamento?: string | null;
  categoria?: string | null;
  link?: string | null;
  /** valores das colunas configuráveis, por `CampoMusica.chave` */
  extras?: Record<string, unknown>;
}

function paraLinha(entrada: MusicaInput) {
  return {
    titulo: entrada.titulo,
    artista: entrada.artista ?? null,
    tom: entrada.tom ?? null,
    andamento: entrada.andamento ?? null,
    categoria: entrada.categoria ?? null,
    link: entrada.link ?? null,
    extras: entrada.extras ?? {},
  };
}

export async function criarMusica(
  client: SupabaseClient,
  ministerioId: string,
  entrada: MusicaInput,
): Promise<Musica> {
  const { data, error } = await client
    .from("musicas")
    .insert({ ministerio_id: ministerioId, ...paraLinha(entrada) })
    .select(COLUNAS_MUSICA)
    .single();
  if (error) throw error;
  return mapMusica(data as MusicaRow);
}

export async function atualizarMusica(
  client: SupabaseClient,
  musicaId: string,
  entrada: MusicaInput,
): Promise<Musica> {
  const { data, error } = await client
    .from("musicas")
    .update(paraLinha(entrada))
    .eq("id", musicaId)
    .select(COLUNAS_MUSICA)
    .single();
  if (error) throw error;
  return mapMusica(data as MusicaRow);
}

/**
 * Tira a música de uso sem apagar (vira "repertório antigo"). Apagar de vez
 * quebraria o cronograma de cultos passados, que referencia a música.
 */
export async function definirMusicaAtiva(
  client: SupabaseClient,
  musicaId: string,
  ativa: boolean,
): Promise<void> {
  const { error } = await client.from("musicas").update({ ativa }).eq("id", musicaId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

interface CategoriaRow {
  id: string;
  ministerio_id: string;
  nome: string;
  ordem: number;
}

function mapCategoria(row: CategoriaRow): CategoriaMusica {
  return { id: row.id, ministerioId: row.ministerio_id, nome: row.nome, ordem: row.ordem };
}

export async function listarCategoriasMusica(
  client: SupabaseClient,
  ministerioId: string,
): Promise<CategoriaMusica[]> {
  const { data, error } = await client
    .from("categorias_musica")
    .select("id, ministerio_id, nome, ordem")
    .eq("ministerio_id", ministerioId)
    .order("ordem");
  if (error) throw error;
  return (data as CategoriaRow[]).map(mapCategoria);
}

export async function criarCategoriaMusica(
  client: SupabaseClient,
  ministerioId: string,
  nome: string,
  ordem = 0,
): Promise<CategoriaMusica> {
  const { data, error } = await client
    .from("categorias_musica")
    .insert({ ministerio_id: ministerioId, nome, ordem })
    .select("id, ministerio_id, nome, ordem")
    .single();
  if (error) throw error;
  return mapCategoria(data as CategoriaRow);
}

export async function removerCategoriaMusica(client: SupabaseClient, categoriaId: string): Promise<void> {
  const { error } = await client.from("categorias_musica").delete().eq("id", categoriaId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Campos configuráveis
// ---------------------------------------------------------------------------

interface CampoRow {
  id: string;
  ministerio_id: string;
  chave: string;
  rotulo: string;
  ordem: number;
}

function mapCampo(row: CampoRow): CampoMusica {
  return {
    id: row.id,
    ministerioId: row.ministerio_id,
    chave: row.chave,
    rotulo: row.rotulo,
    ordem: row.ordem,
  };
}

export async function listarCamposMusica(
  client: SupabaseClient,
  ministerioId: string,
): Promise<CampoMusica[]> {
  const { data, error } = await client
    .from("campos_musica")
    .select("id, ministerio_id, chave, rotulo, ordem")
    .eq("ministerio_id", ministerioId)
    .order("ordem");
  if (error) throw error;
  return (data as CampoRow[]).map(mapCampo);
}

/**
 * Cria uma coluna nova no repertório. A chave é derivada do rótulo e é o que
 * indexa `musicas.extras`, por isso nunca muda depois de criada.
 */
export async function criarCampoMusica(
  client: SupabaseClient,
  ministerioId: string,
  rotulo: string,
  ordem = 0,
): Promise<CampoMusica> {
  const { data, error } = await client
    .from("campos_musica")
    .insert({ ministerio_id: ministerioId, chave: chaveDoRotulo(rotulo), rotulo, ordem })
    .select("id, ministerio_id, chave, rotulo, ordem")
    .single();
  if (error) throw error;
  return mapCampo(data as CampoRow);
}

export async function removerCampoMusica(client: SupabaseClient, campoId: string): Promise<void> {
  const { error } = await client.from("campos_musica").delete().eq("id", campoId);
  if (error) throw error;
}

/**
 * Transforma o rótulo digitado pelo líder ("Quem canta") numa chave estável
 * para o jsonb ("quem_canta"). Pura de propósito: é testada.
 */
export function chaveDoRotulo(rotulo: string): string {
  return rotulo
    .normalize("NFD") // separa o acento da letra para o passo seguinte removê-lo
    .replace(/[\u0300-\u036f]/g, "") // remove os acentos já separados
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
