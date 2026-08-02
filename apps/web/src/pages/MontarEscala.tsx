import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  adicionarItemCronograma,
  atualizarItemCronograma,
  definirEscalacao,
  funcoesObrigatoriasFaltando,
  gerarTextoEscala,
  linkWhatsApp,
  listarCategoriasMusica,
  listarCronograma,
  listarEscalacoesPorFuncao,
  listarMembrosDoMinisterio,
  listarMusicas,
  moverItem,
  proximaOrdem,
  removerItemCronograma,
  salvarOrdemCronograma,
  obterContextoValidacaoEscalacao,
  obterEvento,
  obterMinisterio,
  obterOuCriarEscala,
  obterUltimoEnvio,
  publicarEscala,
  registrarEnvio,
  validarEscalacao,
  type CategoriaMusica,
  type Envio,
  type Escala,
  type EscalacaoDaFuncao,
  type Evento,
  type ItemCronograma,
  type MembroMinisterioComPerfil,
  type Ministerio,
  type Musica,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rotuloConfirmacao(confirmacao: string | null): { texto: string; classe: string } | null {
  if (!confirmacao) return null;
  if (confirmacao === "confirmado") return { texto: "Confirmado", classe: "bg-emerald-100 text-emerald-700" };
  if (confirmacao === "recusado") return { texto: "Não vai", classe: "bg-red-100 text-red-700" };
  return { texto: "Aguardando confirmação", classe: "bg-amber-100 text-amber-700" };
}

interface MensagensValidacao {
  bloqueios: string[];
  avisos: string[];
}

export function MontarEscala() {
  const { eventoId, ministerioId } = useParams<{ eventoId: string; ministerioId: string }>();
  const { perfil } = useAuth();

  const [evento, setEvento] = useState<Evento | null>(null);
  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [escala, setEscala] = useState<Escala | null>(null);
  const [linhas, setLinhas] = useState<EscalacaoDaFuncao[]>([]);
  const [membros, setMembros] = useState<MembroMinisterioComPerfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagensPorFuncao, setMensagensPorFuncao] = useState<Record<string, MensagensValidacao>>({});
  const [ultimoEnvio, setUltimoEnvio] = useState<Envio | null>(null);
  const [cronograma, setCronograma] = useState<ItemCronograma[]>([]);
  const [repertorio, setRepertorio] = useState<Musica[]>([]);
  const [categorias, setCategorias] = useState<CategoriaMusica[]>([]);
  const [musicaParaAdicionar, setMusicaParaAdicionar] = useState("");

  async function carregar() {
    if (!eventoId || !ministerioId || !perfil) return;
    setCarregando(true);
    setErro(null);
    try {
      const [eventoCarregado, ministerioCarregado, membrosCarregados] = await Promise.all([
        obterEvento(supabase, eventoId),
        obterMinisterio(supabase, ministerioId),
        listarMembrosDoMinisterio(supabase, ministerioId),
      ]);
      setEvento(eventoCarregado);
      setMinisterio(ministerioCarregado);
      setMembros(membrosCarregados);

      const escalaAtual = await obterOuCriarEscala(supabase, eventoId, ministerioId, perfil.id);
      setEscala(escalaAtual);
      const [linhasCarregadas, envioCarregado, cronogramaCarregado, repertorioCarregado, categoriasCarregadas] =
        await Promise.all([
          listarEscalacoesPorFuncao(supabase, escalaAtual.id, ministerioId),
          obterUltimoEnvio(supabase, escalaAtual.id),
          listarCronograma(supabase, escalaAtual.id),
          listarMusicas(supabase, ministerioId),
          listarCategoriasMusica(supabase, ministerioId),
        ]);
      setLinhas(linhasCarregadas);
      setUltimoEnvio(envioCarregado);
      setCronograma(cronogramaCarregado);
      setRepertorio(repertorioCarregado);
      setCategorias(categoriasCarregadas);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar a escala.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId, ministerioId, perfil?.id]);

  async function handleAlterarEscalacao(funcaoId: string, perfilId: string) {
    if (!escala || !evento || !ministerioId) return;
    setErro(null);
    setMensagensPorFuncao((atual) => ({ ...atual, [funcaoId]: { bloqueios: [], avisos: [] } }));
    try {
      if (perfilId) {
        const contexto = await obterContextoValidacaoEscalacao(supabase, {
          pessoaId: perfilId,
          ministerioId,
          funcaoId,
          dataEvento: evento.dataHora.slice(0, 10),
          eventoId: evento.id,
          escalaId: escala.id,
        });
        const resultado = validarEscalacao(contexto);
        if (resultado.bloqueios.length > 0) {
          setMensagensPorFuncao((atual) => ({
            ...atual,
            [funcaoId]: { bloqueios: resultado.bloqueios.map((b) => b.mensagem), avisos: [] },
          }));
          return;
        }
        if (resultado.avisos.length > 0) {
          setMensagensPorFuncao((atual) => ({
            ...atual,
            [funcaoId]: { bloqueios: [], avisos: resultado.avisos.map((a) => a.mensagem) },
          }));
        }
      }
      await definirEscalacao(supabase, escala.id, funcaoId, perfilId || null);
      setLinhas(await listarEscalacoesPorFuncao(supabase, escala.id, ministerioId));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a escalação.");
    }
  }

  async function recarregarCronograma() {
    if (!escala) return;
    setCronograma(await listarCronograma(supabase, escala.id));
  }

  async function handleAdicionarMusica() {
    if (!escala || !musicaParaAdicionar) return;
    setErro(null);
    try {
      await adicionarItemCronograma(supabase, escala.id, {
        musicaId: musicaParaAdicionar,
        ordem: proximaOrdem(cronograma),
      });
      setMusicaParaAdicionar("");
      await recarregarCronograma();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível adicionar a música.");
    }
  }

  async function handleMoverMusica(indice: number, direcao: -1 | 1) {
    const destino = indice + direcao;
    if (destino < 0 || destino >= cronograma.length) return;

    // Mostra a nova ordem na hora; o banco confirma logo atrás.
    const reordenado = moverItem(cronograma, indice, destino);
    setCronograma(reordenado);
    try {
      await salvarOrdemCronograma(supabase, reordenado.map((item) => item.id));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível reordenar o cronograma.");
      await recarregarCronograma();
    }
  }

  async function handleAtualizarItem(
    itemId: string,
    campos: { tomDoDia?: string | null; momento?: string | null },
  ) {
    try {
      await atualizarItemCronograma(supabase, itemId, campos);
      await recarregarCronograma();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar a música.");
    }
  }

  async function handleRemoverItem(itemId: string) {
    try {
      await removerItemCronograma(supabase, itemId);
      await recarregarCronograma();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível remover a música.");
    }
  }

  async function handleCompartilhar() {
    if (!escala || !evento || !ministerio) return;
    setErro(null);

    const texto = gerarTextoEscala({
      ministerioNome: ministerio.nome,
      eventoTitulo: evento.titulo,
      dataHora: evento.dataHora,
      observacoes: evento.observacoes,
      itens: linhas.map((linha) => ({ funcaoNome: linha.funcaoNome, pessoaNome: linha.perfilNome })),
      cronograma: cronograma.map((item) => ({
        titulo: item.musicaTitulo,
        tom: item.tomDoDia ?? item.musicaTom,
        momento: item.momento,
      })),
    });

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: texto });
      } else {
        window.open(linkWhatsApp(texto), "_blank", "noopener");
      }
    } catch (error) {
      // O usuário fechar a folha de compartilhamento não é erro nem envio.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErro(error instanceof Error ? error.message : "Não foi possível compartilhar a escala.");
      return;
    }

    try {
      setUltimoEnvio(await registrarEnvio(supabase, escala.id, "whatsapp"));
    } catch {
      // A escala já foi compartilhada; o histórico é secundário e não vale
      // alarmar o líder com um erro vermelho se só o registro falhou.
    }
  }

  async function handlePublicar() {
    if (!escala) return;
    setPublicando(true);
    setErro(null);
    try {
      await publicarEscala(supabase, escala.id);
      setEscala({ ...escala, status: "publicada", publicadaEm: new Date().toISOString() });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível publicar a escala.");
    } finally {
      setPublicando(false);
    }
  }

  if (carregando) {
    return (
      <Layout>
        <p className="text-sm text-slate-500">Carregando...</p>
      </Layout>
    );
  }

  if (!evento || !ministerio || !escala) {
    return (
      <Layout>
        <p className="text-sm text-red-600">Não foi possível encontrar este evento ou ministério.</p>
      </Layout>
    );
  }

  const faltando = funcoesObrigatoriasFaltando(
    linhas.filter((l) => l.obrigatoria).map((l) => ({ id: l.funcaoId, nome: l.funcaoNome })),
    linhas.filter((l) => l.perfilId).map((l) => l.funcaoId),
  );

  return (
    <Layout>
      <p className="text-sm text-slate-500">{ministerio.nome}</p>
      <h1 className="text-lg font-semibold text-slate-900">{evento.titulo}</h1>
      <p className="text-sm text-slate-500">{formatarDataHora(evento.dataHora)}</p>

      <div className="mt-2">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            escala.status === "publicada" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {escala.status === "publicada" ? "Publicada" : "Rascunho"}
        </span>
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}

      {linhas.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Este ministério ainda não tem funções cadastradas. Cadastre pelo menos uma em
          Ministérios → {ministerio.nome}.
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {linhas.map((linha) => {
            const mensagens = mensagensPorFuncao[linha.funcaoId];
            const confirmacao = rotuloConfirmacao(linha.confirmacao);
            return (
              <li key={linha.funcaoId} className="px-4 py-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{linha.funcaoNome}</p>
                    {linha.obrigatoria && <p className="text-xs text-amber-600">obrigatória</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {confirmacao && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${confirmacao.classe}`}>
                        {confirmacao.texto}
                      </span>
                    )}
                    <select
                      value={linha.perfilId ?? ""}
                      onChange={(event) => void handleAlterarEscalacao(linha.funcaoId, event.target.value)}
                      className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">Ninguém escalado</option>
                      {membros.map((membro) => (
                        <option key={membro.perfilId} value={membro.perfilId}>
                          {membro.nome}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {mensagens?.bloqueios.map((mensagem, indice) => (
                  <p key={`b-${indice}`} className="mt-1.5 text-xs text-red-600">
                    {mensagem}
                  </p>
                ))}
                {mensagens?.avisos.map((mensagem, indice) => (
                  <p key={`a-${indice}`} className="mt-1.5 text-xs text-amber-600">
                    {mensagem}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      {faltando.length > 0 && (
        <p className="mt-3 text-sm text-amber-600">
          Ainda faltam pessoas nas funções obrigatórias: {faltando.map((f) => f.nome).join(", ")}.
        </p>
      )}

      {/* Só faz sentido para ministério que mantém repertório (louvor). */}
      {(repertorio.length > 0 || cronograma.length > 0) && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700">Cronograma do culto</h2>

          {cronograma.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">Nenhuma música no cronograma ainda.</p>
          ) : (
            <ol className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              {cronograma.map((item, indice) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="text-sm text-slate-400">{indice + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.musicaTitulo}</p>
                    {item.musicaTom && (
                      <p className="text-xs text-slate-500">tom original: {item.musicaTom}</p>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Tom do dia"
                    defaultValue={item.tomDoDia ?? ""}
                    onBlur={(event) => {
                      const valor = event.target.value.trim();
                      if (valor !== (item.tomDoDia ?? "")) {
                        void handleAtualizarItem(item.id, { tomDoDia: valor || null });
                      }
                    }}
                    className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  />

                  <select
                    value={item.momento ?? ""}
                    onChange={(event) =>
                      void handleAtualizarItem(item.id, { momento: event.target.value || null })
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">Momento</option>
                    {categorias.map((categoria) => (
                      <option key={categoria.id} value={categoria.nome}>
                        {categoria.nome}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleMoverMusica(indice, -1)}
                      disabled={indice === 0}
                      className="rounded border border-slate-300 px-2 text-sm text-slate-600 disabled:opacity-30"
                      aria-label={`Subir ${item.musicaTitulo}`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleMoverMusica(indice, 1)}
                      disabled={indice === cronograma.length - 1}
                      className="rounded border border-slate-300 px-2 text-sm text-slate-600 disabled:opacity-30"
                      aria-label={`Descer ${item.musicaTitulo}`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRemoverItem(item.id)}
                      className="text-xs text-red-600 underline hover:text-red-700"
                    >
                      Remover
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          )}

          {repertorio.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={musicaParaAdicionar}
                onChange={(event) => setMusicaParaAdicionar(event.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm sm:flex-none"
              >
                <option value="">Escolha uma música do repertório...</option>
                {repertorio.map((musica) => (
                  <option key={musica.id} value={musica.id}>
                    {musica.titulo}
                    {musica.tom ? ` (${musica.tom})` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void handleAdicionarMusica()}
                disabled={!musicaParaAdicionar}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handlePublicar()}
          disabled={publicando || escala.status === "publicada"}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {escala.status === "publicada" ? "Escala publicada" : publicando ? "Publicando..." : "Publicar escala"}
        </button>

        {escala.status === "publicada" && (
          <button
            type="button"
            onClick={() => void handleCompartilhar()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Compartilhar no WhatsApp
          </button>
        )}
      </div>

      {escala.status === "publicada" && ultimoEnvio?.enviadoEm && (
        <p className="mt-2 text-xs text-slate-500">
          Compartilhada pela última vez em {formatarDataHora(ultimoEnvio.enviadoEm)}.
        </p>
      )}
    </Layout>
  );
}
