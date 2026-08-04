import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarContaNova } from "./ambiente.js";
import {
  adicionarMembroExistente,
  atualizarEvento,
  atualizarFuncao,
  atualizarMinisterio,
  contarEscalacoesDaFuncao,
  contarEscalacoesDoEvento,
  contarEscalacoesDoMinisterio,
  criarConvite,
  criarEvento,
  criarFuncao,
  criarIgreja,
  definirEscalacao,
  definirEventoAtivo,
  definirFuncaoAtiva,
  definirMinisterioAtivo,
  listarEscalacoesPorFuncao,
  listarFuncoes,
  listarMembrosDoMinisterio,
  listarMinhasEscalacoes,
  listarMinisterios,
  listarProximosEventos,
  obterMeuPerfil,
  obterOuCriarEscala,
  obterRelatorioParticipacao,
  publicarEscala,
  removerFuncao,
  removerMembro,
  usarConvite,
  type Funcao,
} from "../index.js";

/**
 * Corrigir o que foi criado errado (Etapa 6.2/6.3).
 *
 * Como o arquivo de convites, este monta a própria igreja a cada execução em
 * vez de mexer na "Igreja Exemplo" do seed — arquivar e excluir alteram
 * contagens, e `fluxo.integracao.test.ts` confere os números do seed linha por
 * linha. Com isso este arquivo também roda várias vezes seguidas sem reset.
 */

// Um domingo à noite bem no futuro: precisa ser futuro para aparecer em
// `listarProximosEventos`, e num mês só dele para o relatório ficar previsível.
const DATA_EVENTO = "2027-05-16T22:00:00.000Z";
const MES_DO_EVENTO = { inicio: "2027-05-01", fim: "2027-05-31" };
/** Noutro mês, para o rascunho não encostar na janela do relatório. */
const DATA_ENSAIO = "2027-06-10T22:00:00.000Z";

describe("Arquivar e editar", () => {
  let admin: SupabaseClient;
  let lider: SupabaseClient;
  let membro: SupabaseClient;

  let idIgreja: string;
  let idLouvor: string;
  let idRecepcao: string;
  let idEvento: string;
  let idEscala: string;
  let idEventoRascunho: string;
  let idEscalaRascunho: string;
  let funcaoUsada: Funcao;
  let funcaoSemUso: Funcao;
  let idPerfilLider: string;

  beforeAll(async () => {
    admin = (await criarContaNova("Ana Administradora")).client;
    idIgreja = await criarIgreja(admin, `Igreja Arquivo ${Date.now()}`, "America/Sao_Paulo");

    const criarMinisterio = async (nome: string) => {
      const { data, error } = await admin
        .from("ministerios")
        .insert({ igreja_id: idIgreja, nome })
        .select("id")
        .single();
      if (error) throw error;
      return (data as { id: string }).id;
    };

    idLouvor = await criarMinisterio("Louvor");
    idRecepcao = await criarMinisterio("Recepção");

    funcaoUsada = await criarFuncao(admin, idLouvor, "Vocaal", true);
    funcaoSemUso = await criarFuncao(admin, idLouvor, "Função criada por engano");

    // Alguém que lidera SÓ a Recepção. É a peça que torna honesto o teste da
    // contagem por evento: pela RLS ele não enxerga as escalações do Louvor.
    const conviteLider = await criarConvite(admin, { ministerioId: idRecepcao, papel: "lider" });
    lider = (await criarContaNova("Léo Líder")).client;
    await usarConvite(lider, conviteLider.codigo);
    idPerfilLider = (await obterMeuPerfil(lider))!.id;
    await adicionarMembroExistente(admin, idLouvor, idPerfilLider);

    const conviteMembro = await criarConvite(admin, { ministerioId: idLouvor, papel: "membro" });
    membro = (await criarContaNova("Marta Membro")).client;
    await usarConvite(membro, conviteMembro.codigo);
    const idPerfilMembro = (await obterMeuPerfil(membro))!.id;

    const idPerfilAdmin = (await obterMeuPerfil(admin))!.id;

    const evento = await criarEvento(admin, idIgreja, "Culto de teste", DATA_EVENTO);
    idEvento = evento.id;

    const escala = await obterOuCriarEscala(admin, idEvento, idLouvor, idPerfilAdmin);
    idEscala = escala.id;
    await definirEscalacao(admin, idEscala, funcaoUsada.id, idPerfilLider);
    await publicarEscala(admin, idEscala);

    // Um segundo evento, com a escala do Louvor ainda em RASCUNHO: é o caso em
    // que a RLS realmente esconde as escalações de quem não lidera aquele
    // ministério.
    const ensaio = await criarEvento(admin, idIgreja, "Ensaio de teste", DATA_ENSAIO, "ensaio");
    idEventoRascunho = ensaio.id;
    const rascunho = await obterOuCriarEscala(admin, idEventoRascunho, idLouvor, idPerfilAdmin);
    idEscalaRascunho = rascunho.id;
    await definirEscalacao(admin, idEscalaRascunho, funcaoUsada.id, idPerfilMembro);
  });

  // -------------------------------------------------------------------------
  // Editar
  // -------------------------------------------------------------------------

  it("corrige o nome do ministério, do evento e da função", async () => {
    const ministerio = await atualizarMinisterio(admin, idLouvor, {
      nome: "Louvor e Adoração",
      descricao: "Equipe de música dos cultos",
    });
    expect(ministerio.nome).toBe("Louvor e Adoração");
    expect(ministerio.descricao).toBe("Equipe de música dos cultos");

    // O engano mais comum de todos: a data do culto.
    const novaData = "2027-05-16T23:00:00.000Z";
    const evento = await atualizarEvento(admin, idEvento, {
      titulo: "Culto de domingo",
      dataHoraIso: novaData,
    });
    expect(evento.titulo).toBe("Culto de domingo");
    expect(new Date(evento.dataHora).toISOString()).toBe(novaData);

    const funcao = await atualizarFuncao(admin, funcaoUsada.id, { nome: "Vocal" });
    expect(funcao.nome).toBe("Vocal");
    funcaoUsada = funcao;
  });

  it("membro comum não consegue mexer nas funções — e recebe erro, não silêncio", async () => {
    // Este é o ponto do `.select("id")`: com RLS filtrando tudo, o PostgREST
    // devolve 200 com zero linhas. Sem a checagem, a tela dizia "pronto" e o
    // item voltava sozinho na recarga seguinte.
    await expect(atualizarFuncao(membro, funcaoUsada.id, { nome: "Invadido" })).rejects.toThrow(
      /não tem permissão/i,
    );
    await expect(definirFuncaoAtiva(membro, funcaoUsada.id, false)).rejects.toThrow(
      /não tem permissão/i,
    );

    const funcoes = await listarFuncoes(admin, idLouvor);
    expect(funcoes.find((funcao) => funcao.id === funcaoUsada.id)?.nome).toBe("Vocal");
  });

  // -------------------------------------------------------------------------
  // Contar o histórico antes de decidir
  // -------------------------------------------------------------------------

  it("conta as escalações de cada coisa", async () => {
    // Duas: a do culto (publicada) e a do ensaio (rascunho). Rascunho conta
    // aqui de propósito — é trabalho que sumiria num DELETE em cascade.
    expect(await contarEscalacoesDaFuncao(admin, funcaoUsada.id)).toBe(2);
    expect(await contarEscalacoesDaFuncao(admin, funcaoSemUso.id)).toBe(0);
    expect(await contarEscalacoesDoMinisterio(admin, idLouvor)).toBe(2);
    expect(await contarEscalacoesDoMinisterio(admin, idRecepcao)).toBe(0);
  });

  it("a contagem do evento enxerga o rascunho do ministério que quem pergunta não lidera", async () => {
    // O caso perigoso de verdade: o Louvor montou um RASCUNHO para o ensaio.
    // Léo lidera só a Recepção, e a policy de `escalacoes` só mostra escala
    // publicada a quem não é líder dela — para ele, aquele rascunho não existe.
    // Se o app contasse pelo cliente, leria zero, ofereceria "excluir de vez" e
    // o DELETE em cascade apagaria o trabalho do Louvor. Por isso a conta mora
    // numa função `security definer`, que enxerga a igreja inteira.
    const escalacoesVisiveis = await lider
      .from("escalacoes")
      .select("id")
      .eq("escala_id", idEscalaRascunho);
    expect(escalacoesVisiveis.data ?? []).toHaveLength(0);

    expect(await contarEscalacoesDoEvento(lider, idEventoRascunho)).toBe(1);
    expect(await contarEscalacoesDoEvento(admin, idEvento)).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Excluir o que nunca foi usado
  // -------------------------------------------------------------------------

  it("exclui de vez a função que nunca entrou em escala", async () => {
    await removerFuncao(admin, funcaoSemUso.id);

    const funcoes = await listarFuncoes(admin, idLouvor, true);
    expect(funcoes.map((funcao) => funcao.id)).not.toContain(funcaoSemUso.id);
  });

  it("excluir de novo o que já sumiu avisa em vez de fingir que deu certo", async () => {
    await expect(removerFuncao(admin, funcaoSemUso.id)).rejects.toThrow(/não tem permissão|já não existe/i);
  });

  // -------------------------------------------------------------------------
  // Arquivar o que tem histórico
  // -------------------------------------------------------------------------

  it("arquivar a função a tira das listas sem mexer no relatório", async () => {
    const antes = await obterRelatorioParticipacao(admin, {
      ministerioId: idLouvor,
      dataInicio: MES_DO_EVENTO.inicio,
      dataFim: MES_DO_EVENTO.fim,
      fusoHorario: "America/Sao_Paulo",
    });
    expect(antes.totalEscalacoes).toBe(1);

    await definirFuncaoAtiva(admin, funcaoUsada.id, false);

    const ativas = await listarFuncoes(admin, idLouvor);
    expect(ativas.map((funcao) => funcao.id)).not.toContain(funcaoUsada.id);

    const todas = await listarFuncoes(admin, idLouvor, true);
    expect(todas.map((funcao) => funcao.id)).toContain(funcaoUsada.id);

    // O ponto da regra: arquivar não pode mudar o passado. Se a função fosse
    // apagada, o cascade em `escalacoes.funcao_id` zeraria este número.
    const depois = await obterRelatorioParticipacao(admin, {
      ministerioId: idLouvor,
      dataInicio: MES_DO_EVENTO.inicio,
      dataFim: MES_DO_EVENTO.fim,
      fusoHorario: "America/Sao_Paulo",
    });
    expect(depois.totalEscalacoes).toBe(antes.totalEscalacoes);
    expect(depois.linhas).toHaveLength(antes.linhas.length);
  });

  it("a escala já montada continua mostrando quem serve na função arquivada", async () => {
    const linhas = await listarEscalacoesPorFuncao(admin, idEscala, idLouvor);
    const linha = linhas.find((atual) => atual.funcaoId === funcaoUsada.id);

    expect(linha).toBeDefined();
    expect(linha?.arquivada).toBe(true);
    expect(linha?.perfilId).toBe(idPerfilLider);

    await definirFuncaoAtiva(admin, funcaoUsada.id, true);
  });

  it("arquivar o evento o tira da agenda e das escalas de quem serve", async () => {
    expect((await listarMinhasEscalacoes(lider, idPerfilLider)).map((e) => e.eventoTitulo)).toContain(
      "Culto de domingo",
    );

    await definirEventoAtivo(admin, idEvento, false);

    expect((await listarProximosEventos(admin, idIgreja)).map((e) => e.id)).not.toContain(idEvento);
    expect((await listarProximosEventos(admin, idIgreja, true)).map((e) => e.id)).toContain(idEvento);
    expect(await listarMinhasEscalacoes(lider, idPerfilLider)).toHaveLength(0);

    await definirEventoAtivo(admin, idEvento, true);
    expect(await listarMinhasEscalacoes(lider, idPerfilLider)).toHaveLength(1);
  });

  it("arquivar o ministério o tira da lista e deixa desarquivar", async () => {
    await definirMinisterioAtivo(admin, idRecepcao, false);

    expect((await listarMinisterios(admin, idIgreja)).map((m) => m.id)).not.toContain(idRecepcao);
    expect((await listarMinisterios(admin, idIgreja, true)).map((m) => m.id)).toContain(idRecepcao);

    await definirMinisterioAtivo(admin, idRecepcao, true);
    expect((await listarMinisterios(admin, idIgreja)).map((m) => m.id)).toContain(idRecepcao);
  });

  // -------------------------------------------------------------------------
  // Último líder
  // -------------------------------------------------------------------------

  it("o único líder do ministério não consegue sair sozinho", async () => {
    const membros = await listarMembrosDoMinisterio(lider, idRecepcao);
    const vinculo = membros.find((atual) => atual.perfilId === idPerfilLider);
    expect(vinculo?.papel).toBe("lider");

    // Sem o trigger, a Recepção ficaria sem ninguém capaz de montar escala — e
    // sem ninguém capaz de se readicionar, porque a policy de INSERT em
    // `membros_ministerio` exige justamente ser líder.
    await expect(removerMembro(lider, vinculo!.id)).rejects.toThrow(/único líder/i);

    const aindaLa = await listarMembrosDoMinisterio(lider, idRecepcao);
    expect(aindaLa.find((atual) => atual.perfilId === idPerfilLider)?.ativo).toBe(true);
  });
});
