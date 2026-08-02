import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import {
  atualizarMusica,
  criarCampoMusica,
  criarCategoriaMusica,
  criarMusica,
  definirMusicaAtiva,
  listarCamposMusica,
  listarCategoriasMusica,
  listarMembrosDoMinisterio,
  listarMusicas,
  obterMinisterio,
  removerCampoMusica,
  removerCategoriaMusica,
  type CampoMusica,
  type CategoriaMusica,
  type MembroMinisterioComPerfil,
  type Ministerio,
  type Musica,
  type MusicaInput,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

const FORMULARIO_VAZIO: MusicaInput = {
  titulo: "",
  artista: "",
  tom: "",
  andamento: "",
  categoria: "",
  link: "",
  extras: {},
};

export function Repertorio() {
  const { id: ministerioId } = useParams<{ id: string }>();
  const { perfil } = useAuth();

  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [musicas, setMusicas] = useState<Musica[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMusica[]>([]);
  const [campos, setCampos] = useState<CampoMusica[]>([]);
  const [membros, setMembros] = useState<MembroMinisterioComPerfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [mostrarAntigas, setMostrarAntigas] = useState(false);
  const [formulario, setFormulario] = useState<MusicaInput>(FORMULARIO_VAZIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [novaCategoria, setNovaCategoria] = useState("");
  const [novoCampo, setNovoCampo] = useState("");

  const souLider = useMemo(() => {
    if (!perfil) return false;
    if (perfil.papelGlobal === "admin") return true;
    return membros.some((m) => m.perfilId === perfil.id && m.papel === "lider");
  }, [perfil, membros]);

  async function carregar() {
    if (!ministerioId) return;
    setCarregando(true);
    setErro(null);
    try {
      const [ministerioCarregado, musicasCarregadas, categoriasCarregadas, camposCarregados, membrosCarregados] =
        await Promise.all([
          obterMinisterio(supabase, ministerioId),
          listarMusicas(supabase, ministerioId, mostrarAntigas),
          listarCategoriasMusica(supabase, ministerioId),
          listarCamposMusica(supabase, ministerioId),
          listarMembrosDoMinisterio(supabase, ministerioId),
        ]);
      setMinisterio(ministerioCarregado);
      setMusicas(musicasCarregadas);
      setCategorias(categoriasCarregadas);
      setCampos(camposCarregados);
      setMembros(membrosCarregados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o repertório.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ministerioId, mostrarAntigas]);

  function editar(musica: Musica) {
    setEditandoId(musica.id);
    setFormulario({
      titulo: musica.titulo,
      artista: musica.artista ?? "",
      tom: musica.tom ?? "",
      andamento: musica.andamento ?? "",
      categoria: musica.categoria ?? "",
      link: musica.link ?? "",
      extras: musica.extras,
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VAZIO);
  }

  async function handleSalvarMusica(event: FormEvent) {
    event.preventDefault();
    if (!ministerioId || !formulario.titulo.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const entrada: MusicaInput = { ...formulario, titulo: formulario.titulo.trim() };
      if (editandoId) {
        await atualizarMusica(supabase, editandoId, entrada);
      } else {
        await criarMusica(supabase, ministerioId, entrada);
      }
      cancelarEdicao();
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a música.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleAlternarAtiva(musica: Musica) {
    try {
      await definirMusicaAtiva(supabase, musica.id, !musica.ativa);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível atualizar a música.");
    }
  }

  async function handleCriarCategoria(event: FormEvent) {
    event.preventDefault();
    if (!ministerioId || !novaCategoria.trim()) return;
    try {
      await criarCategoriaMusica(supabase, ministerioId, novaCategoria.trim(), categorias.length);
      setNovaCategoria("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar a categoria.");
    }
  }

  async function handleCriarCampo(event: FormEvent) {
    event.preventDefault();
    if (!ministerioId || !novoCampo.trim()) return;
    try {
      await criarCampoMusica(supabase, ministerioId, novoCampo.trim(), campos.length);
      setNovoCampo("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar a coluna.");
    }
  }

  if (carregando) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Carregando...</p>
      </Layout>
    );
  }

  if (!ministerio) {
    return (
      <Layout>
        <p className="text-sm text-red-600">Ministério não encontrado.</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <p className="text-sm text-slate-500">{ministerio.nome}</p>
      <h1 className="text-lg font-semibold text-slate-900">Repertório</h1>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={mostrarAntigas}
          onChange={(event) => setMostrarAntigas(event.target.checked)}
        />
        Mostrar também o repertório antigo
      </label>

      {musicas.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Nenhuma música cadastrada ainda.</p>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {musicas.map((musica) => (
            <li key={musica.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className={`text-sm font-medium ${musica.ativa ? "text-slate-900" : "text-slate-400"}`}>
                  {musica.titulo}
                  {!musica.ativa && <span className="ml-2 text-xs">(repertório antigo)</span>}
                </p>
                <p className="text-sm text-slate-500">
                  {[musica.artista, musica.tom && `tom ${musica.tom}`, musica.andamento, musica.categoria]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {campos.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {campos
                      .filter((campo) => musica.extras[campo.chave])
                      .map((campo) => `${campo.rotulo}: ${String(musica.extras[campo.chave])}`)
                      .join(" · ")}
                  </p>
                )}
                {musica.link && (
                  <a
                    href={musica.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-slate-500 underline hover:text-slate-700"
                  >
                    abrir link
                  </a>
                )}
              </div>
              {souLider && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => editar(musica)}
                    className="text-xs text-slate-600 underline hover:text-slate-800"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleAlternarAtiva(musica)}
                    className="text-xs text-slate-600 underline hover:text-slate-800"
                  >
                    {musica.ativa ? "Tirar de uso" : "Voltar a usar"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {souLider && (
        <>
          <form onSubmit={handleSalvarMusica} className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-medium text-slate-700">
              {editandoId ? "Editar música" : "Nova música"}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                type="text"
                placeholder="Título"
                required
                value={formulario.titulo}
                onChange={(event) => setFormulario({ ...formulario, titulo: event.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Artista / autor"
                value={formulario.artista ?? ""}
                onChange={(event) => setFormulario({ ...formulario, artista: event.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Tom"
                value={formulario.tom ?? ""}
                onChange={(event) => setFormulario({ ...formulario, tom: event.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Andamento"
                value={formulario.andamento ?? ""}
                onChange={(event) => setFormulario({ ...formulario, andamento: event.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={formulario.categoria ?? ""}
                onChange={(event) => setFormulario({ ...formulario, categoria: event.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Sem categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.nome}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
              <input
                type="url"
                placeholder="Link (YouTube, cifra...)"
                value={formulario.link ?? ""}
                onChange={(event) => setFormulario({ ...formulario, link: event.target.value })}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />

              {campos.map((campo) => (
                <input
                  key={campo.id}
                  type="text"
                  placeholder={campo.rotulo}
                  value={String(formulario.extras?.[campo.chave] ?? "")}
                  onChange={(event) =>
                    setFormulario({
                      ...formulario,
                      extras: { ...formulario.extras, [campo.chave]: event.target.value },
                    })
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Adicionar música"}
              </button>
              {editandoId && (
                <button
                  type="button"
                  onClick={cancelarEdicao}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>

          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-700">Categorias</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {categorias.length === 0 && <li className="text-sm text-slate-500">Nenhuma ainda.</li>}
                {categorias.map((categoria) => (
                  <li
                    key={categoria.id}
                    className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700"
                  >
                    {categoria.nome}
                    <button
                      type="button"
                      onClick={() => void removerCategoriaMusica(supabase, categoria.id).then(carregar)}
                      className="text-xs text-red-600 hover:text-red-700"
                      aria-label={`Remover categoria ${categoria.nome}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleCriarCategoria} className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Nova categoria"
                  value={novaCategoria}
                  onChange={(event) => setNovaCategoria(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Criar
                </button>
              </form>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-700">Colunas do repertório</h2>
              <p className="mt-1 text-xs text-slate-500">
                Campos extras além dos fixos (ex: BPM, quem canta, instrumento principal).
              </p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {campos.length === 0 && <li className="text-sm text-slate-500">Nenhuma ainda.</li>}
                {campos.map((campo) => (
                  <li
                    key={campo.id}
                    className="flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700"
                  >
                    {campo.rotulo}
                    <button
                      type="button"
                      onClick={() => void removerCampoMusica(supabase, campo.id).then(carregar)}
                      className="text-xs text-red-600 hover:text-red-700"
                      aria-label={`Remover coluna ${campo.rotulo}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
              <form onSubmit={handleCriarCampo} className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Nova coluna"
                  value={novoCampo}
                  onChange={(event) => setNovoCampo(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Criar
                </button>
              </form>
            </div>
          </section>
        </>
      )}
    </Layout>
  );
}
