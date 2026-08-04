import type { SupabaseClient } from "../supabase.js";
import type { CampoMusica, CategoriaMusica, Musica } from "../types.js";
import { exigirLinhaAfetada, semPermissao } from "./linhas.js";

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
  const { data, error } = await client.from("musicas").update({ ativa }).eq("id", musicaId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta música"));
}

/**
 * Apaga a música de vez. Só para música digitada errada que nunca entrou em
 * cronograma nenhum: `cronograma_itens.musica_id` é `on delete restrict`, então
 * o próprio banco recusa se ela já foi cantada. `contarUsosDaMusica` existe para
 * a tela explicar isso antes, em vez de deixar o erro do Postgres chegar cru.
 */
export async function removerMusica(client: SupabaseClient, musicaId: string): Promise<void> {
  const { data, error } = await client.from("musicas").delete().eq("id", musicaId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta música"));
}

/** Em quantos cronogramas esta música já apareceu. */
export async function contarUsosDaMusica(client: SupabaseClient, musicaId: string): Promise<number> {
  const { data, error } = await client.rpc("contar_usos_da_musica", { p_musica_id: musicaId });
  if (error) throw error;
  return (data as number | null) ?? 0;
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

export async function atualizarCategoriaMusica(
  client: SupabaseClient,
  categoriaId: string,
  campos: { nome?: string; ordem?: number },
): Promise<CategoriaMusica> {
  const atualizacao: Record<string, unknown> = {};
  if (typeof campos.nome === "string") atualizacao.nome = campos.nome;
  if (typeof campos.ordem === "number") atualizacao.ordem = campos.ordem;

  const { data, error } = await client
    .from("categorias_musica")
    .update(atualizacao)
    .eq("id", categoriaId)
    .select("id, ministerio_id, nome, ordem");
  if (error) throw error;

  const linhas = (data ?? []) as CategoriaRow[];
  if (linhas.length === 0) throw new Error(semPermissao("esta categoria"));
  return mapCategoria(linhas[0]!);
}

export async function removerCategoriaMusica(client: SupabaseClient, categoriaId: string): Promise<void> {
  const { data, error } = await client
    .from("categorias_musica")
    .delete()
    .eq("id", categoriaId)
    .select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta categoria"));
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

/**
 * Renomear a coluna e/ou mudar a posição dela.
 *
 * `chave` fica deliberadamente de fora: ela é o que indexa `musicas.extras`, e
 * trocá-la exigiria reescrever o jsonb de todas as músicas do ministério numa
 * operação sem transação do lado do cliente — qualquer falha no meio deixaria
 * parte do repertório com a chave velha e parte com a nova, e os valores
 * digitados ficariam órfãos, invisíveis na tela mas ocupando espaço.
 *
 * O líder nunca vê a chave; ele vê o rótulo. Manter a chave estável resolve o
 * problema por não criá-lo.
 */
export async function atualizarCampoMusica(
  client: SupabaseClient,
  campoId: string,
  campos: { rotulo?: string; ordem?: number },
): Promise<CampoMusica> {
  const atualizacao: Record<string, unknown> = {};
  if (typeof campos.rotulo === "string") atualizacao.rotulo = campos.rotulo;
  if (typeof campos.ordem === "number") atualizacao.ordem = campos.ordem;

  const { data, error } = await client
    .from("campos_musica")
    .update(atualizacao)
    .eq("id", campoId)
    .select("id, ministerio_id, chave, rotulo, ordem");
  if (error) throw error;

  const linhas = (data ?? []) as CampoRow[];
  if (linhas.length === 0) throw new Error(semPermissao("esta coluna"));
  return mapCampo(linhas[0]!);
}

export async function removerCampoMusica(client: SupabaseClient, campoId: string): Promise<void> {
  const { data, error } = await client.from("campos_musica").delete().eq("id", campoId).select("id");
  if (error) throw error;
  exigirLinhaAfetada(data as { id: string }[] | null, semPermissao("esta coluna"));
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
