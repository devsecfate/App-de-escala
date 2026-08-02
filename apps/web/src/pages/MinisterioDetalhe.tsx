import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  adicionarMembroExistente,
  criarFuncao,
  definirPapelDoMembro,
  listarFuncoes,
  listarMembrosDoMinisterio,
  listarPerfisDaIgreja,
  obterMinisterio,
  obterRegrasMinisterio,
  removerMembro,
  salvarRegrasMinisterio,
  type Funcao,
  type MembroMinisterioComPerfil,
  type Ministerio,
  type PapelMinisterio,
  type Perfil,
  type RegraMinisterio,
} from "@escala-app/core";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Layout } from "../components/Layout";

export function MinisterioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const { perfil } = useAuth();

  const [ministerio, setMinisterio] = useState<Ministerio | null>(null);
  const [membros, setMembros] = useState<MembroMinisterioComPerfil[]>([]);
  const [funcoes, setFuncoes] = useState<Funcao[]>([]);
  const [perfisDaIgreja, setPerfisDaIgreja] = useState<Perfil[]>([]);
  const [regras, setRegras] = useState<RegraMinisterio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [mensagem, setMensagem] = useState<string | null>(null);

  const [novaFuncao, setNovaFuncao] = useState("");
  const [funcaoObrigatoria, setFuncaoObrigatoria] = useState(false);
  const [perfilParaAdicionar, setPerfilParaAdicionar] = useState("");
  const [emailConvite, setEmailConvite] = useState("");
  const [nomeConvite, setNomeConvite] = useState("");
  const [enviandoConvite, setEnviandoConvite] = useState(false);

  const [maxEscalasMes, setMaxEscalasMes] = useState("");
  const [intervaloMinDias, setIntervaloMinDias] = useState("");
  const [bloquearConflito, setBloquearConflito] = useState(false);
  const [salvandoRegras, setSalvandoRegras] = useState(false);

  const souLider = useMemo(() => {
    if (!perfil) return false;
    if (perfil.papelGlobal === "admin") return true;
    return membros.some((m) => m.perfilId === perfil.id && m.papel === "lider");
  }, [perfil, membros]);

  async function carregar() {
    if (!id || !perfil) return;
    setCarregando(true);
    setErro(null);
    try {
      const [ministerioCarregado, membrosCarregados, funcoesCarregadas, regrasCarregadas] = await Promise.all([
        obterMinisterio(supabase, id),
        listarMembrosDoMinisterio(supabase, id),
        listarFuncoes(supabase, id),
        obterRegrasMinisterio(supabase, id),
      ]);
      setMinisterio(ministerioCarregado);
      setMembros(membrosCarregados);
      setFuncoes(funcoesCarregadas);
      setRegras(regrasCarregadas);
      setMaxEscalasMes(regrasCarregadas?.maxEscalasMes?.toString() ?? "");
      setIntervaloMinDias(regrasCarregadas?.intervaloMinDias?.toString() ?? "");
      setBloquearConflito(regrasCarregadas?.bloquearConflitoEvento ?? false);
      setPerfisDaIgreja(await listarPerfisDaIgreja(supabase, perfil.igrejaId));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o ministério.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, perfil?.id]);

  const perfisDisponiveis = perfisDaIgreja.filter(
    (p) => !membros.some((m) => m.perfilId === p.id),
  );

  async function handleCriarFuncao(event: FormEvent) {
    event.preventDefault();
    if (!id || !novaFuncao.trim()) return;
    try {
      await criarFuncao(supabase, id, novaFuncao.trim(), funcaoObrigatoria);
      setNovaFuncao("");
      setFuncaoObrigatoria(false);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível criar a função.");
    }
  }

  async function handleAdicionarExistente(event: FormEvent) {
    event.preventDefault();
    if (!id || !perfilParaAdicionar) return;
    try {
      await adicionarMembroExistente(supabase, id, perfilParaAdicionar);
      setPerfilParaAdicionar("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível adicionar a pessoa.");
    }
  }

  async function handleConvidar(event: FormEvent) {
    event.preventDefault();
    if (!id || !emailConvite.trim() || !nomeConvite.trim()) return;
    setEnviandoConvite(true);
    setErro(null);
    setMensagem(null);
    try {
      const { error } = await supabase.functions.invoke("convidar-membro", {
        body: { email: emailConvite.trim(), nome: nomeConvite.trim(), ministerioId: id, papel: "membro" },
      });
      if (error) throw error;
      setMensagem(`Convite enviado para ${emailConvite.trim()}.`);
      setEmailConvite("");
      setNomeConvite("");
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally {
      setEnviandoConvite(false);
    }
  }

  async function handleAlterarPapel(membro: MembroMinisterioComPerfil, papel: PapelMinisterio) {
    try {
      await definirPapelDoMembro(supabase, membro.id, papel);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível alterar o papel.");
    }
  }

  async function handleRemover(membro: MembroMinisterioComPerfil) {
    try {
      await removerMembro(supabase, membro.id);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível remover a pessoa.");
    }
  }

  async function handleSalvarRegras(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setSalvandoRegras(true);
    setErro(null);
    setMensagem(null);
    try {
      const salvas = await salvarRegrasMinisterio(supabase, id, {
        maxEscalasMes: maxEscalasMes.trim() ? Number(maxEscalasMes) : null,
        intervaloMinDias: intervaloMinDias.trim() ? Number(intervaloMinDias) : null,
        bloquearConflitoEvento: bloquearConflito,
      });
      setRegras(salvas);
      setMensagem("Regras da escala salvas.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível salvar as regras.");
    } finally {
      setSalvandoRegras(false);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-900">{ministerio.nome}</h1>
        <Link
          to={`/ministerios/${ministerio.id}/repertorio`}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Repertório
        </Link>
      </div>

      {erro && <p className="mt-4 text-sm text-red-600">{erro}</p>}
      {mensagem && <p className="mt-4 text-sm text-emerald-600">{mensagem}</p>}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-700">Pessoas</h2>
        <ul className="mt-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {membros.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">Ninguém neste ministério ainda.</li>}
          {membros.map((membro) => (
            <li key={membro.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{membro.nome}</p>
                <p className="text-slate-500">{membro.email}</p>
              </div>
              {souLider ? (
                <div className="flex items-center gap-2">
                  <select
                    value={membro.papel}
                    onChange={(event) => void handleAlterarPapel(membro, event.target.value as PapelMinisterio)}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  >
                    <option value="membro">Membro</option>
                    <option value="lider">Líder</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleRemover(membro)}
                    className="text-xs text-red-600 underline hover:text-red-700"
                  >
                    Remover
                  </button>
                </div>
              ) : (
                <span className="text-xs uppercase text-slate-400">{membro.papel}</span>
              )}
            </li>
          ))}
        </ul>

        {souLider && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <form onSubmit={handleAdicionarExistente} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700">Adicionar pessoa já cadastrada na igreja</p>
              <div className="mt-2 flex gap-2">
                <select
                  value={perfilParaAdicionar}
                  onChange={(event) => setPerfilParaAdicionar(event.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-2 py-2 text-sm"
                >
                  <option value="">Selecione...</option>
                  {perfisDisponiveis.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={!perfilParaAdicionar}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            </form>

            <form onSubmit={handleConvidar} className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700">Convidar por e-mail</p>
              <div className="mt-2 space-y-2">
                <input
                  type="text"
                  placeholder="Nome"
                  value={nomeConvite}
                  onChange={(event) => setNomeConvite(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
                <input
                  type="email"
                  placeholder="E-mail"
                  value={emailConvite}
                  onChange={(event) => setEmailConvite(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={enviandoConvite}
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {enviandoConvite ? "Enviando..." : "Convidar"}
                </button>
              </div>
            </form>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700">Funções</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {funcoes.length === 0 && <li className="text-sm text-slate-500">Nenhuma função cadastrada ainda.</li>}
          {funcoes.map((funcao) => (
            <li
              key={funcao.id}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
            >
              {funcao.nome}
              {funcao.obrigatoria && <span className="ml-1 text-xs text-amber-600">(obrigatória)</span>}
            </li>
          ))}
        </ul>

        {souLider && (
          <form onSubmit={handleCriarFuncao} className="mt-4 flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Nova função (ex: Vocal)"
              value={novaFuncao}
              onChange={(event) => setNovaFuncao(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-1 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={funcaoObrigatoria}
                onChange={(event) => setFuncaoObrigatoria(event.target.checked)}
              />
              Obrigatória
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Criar função
            </button>
          </form>
        )}
      </section>

      {souLider && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700">Regras da escala</h2>
          <p className="mt-1 text-sm text-slate-500">
            Esses limites geram avisos ao montar a escala — o líder decide se segue em frente mesmo assim.
          </p>
          <form
            onSubmit={handleSalvarRegras}
            className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
          >
            <label className="text-sm text-slate-600">
              Máx. de escalas por mês
              <input
                type="number"
                min={1}
                placeholder="Sem limite"
                value={maxEscalasMes}
                onChange={(event) => setMaxEscalasMes(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-sm text-slate-600">
              Intervalo mínimo (dias)
              <input
                type="number"
                min={1}
                placeholder="Sem limite"
                value={intervaloMinDias}
                onChange={(event) => setIntervaloMinDias(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 self-end text-sm text-slate-600">
              <input
                type="checkbox"
                checked={bloquearConflito}
                onChange={(event) => setBloquearConflito(event.target.checked)}
              />
              Impedir (não só avisar) conflito com outro ministério no mesmo evento
            </label>
            <button
              type="submit"
              disabled={salvandoRegras}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 sm:col-span-3 sm:w-fit"
            >
              {salvandoRegras ? "Salvando..." : "Salvar regras"}
            </button>
          </form>
        </section>
      )}
    </Layout>
  );
}
