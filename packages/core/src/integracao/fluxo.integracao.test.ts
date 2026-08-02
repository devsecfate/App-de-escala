import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entrarComo, idDoMinisterio, idDoPerfil, USUARIOS } from "./ambiente.js";
import {
  adicionarItemCronograma,
  atualizarItemCronograma,
  confirmarPresenca,
  criarCampoMusica,
  criarCategoriaMusica,
  criarEvento,
  criarIndisponibilidade,
  criarMusica,
  definirEscalacao,
  definirMusicaAtiva,
  gerarTextoEscala,
  listarCamposMusica,
  listarCronograma,
  listarEscalacoesPorFuncao,
  listarIndisponibilidades,
  listarMinhasEscalacoes,
  listarMusicas,
  obterContextoValidacaoEscalacao,
  obterOuCriarEscala,
  obterRegrasMinisterio,
  obterUltimoEnvio,
  proximaOrdem,
  publicarEscala,
  registrarEnvio,
  removerIndisponibilidade,
  salvarOrdemCronograma,
  salvarRegrasMinisterio,
  validarEscalacao,
} from "../index.js";

/**
 * Fluxo ponta a ponta contra o Postgres real, na ordem que planejamento.md
 * descreve: líder monta a escala vendo indisponibilidade, publica, a pessoa
 * confirma, o líder compartilha. Mais o repertório da Fase 4.
 */
describe("fluxo da escala contra o banco real", () => {
  let lider: SupabaseClient;
  let vocal: SupabaseClient;
  let idLouvor: string;
  let idLider: string;
  let idVocal: string;
  let idIgreja: string;
  let idEvento: string;
  let dataEvento: string;
  let idEscala: string;
  let idFuncaoVocal: string;

  beforeAll(async () => {
    lider = await entrarComo(USUARIOS.liderLouvor);
    vocal = await entrarComo(USUARIOS.vocal1);

    idLouvor = await idDoMinisterio(lider, "Louvor");
    idLider = await idDoPerfil(lider, USUARIOS.liderLouvor);
    idVocal = await idDoPerfil(lider, USUARIOS.vocal1);

    const { data: perfil } = await lider.from("perfis").select("igreja_id").eq("id", idLider).single();
    idIgreja = (perfil as { igreja_id: string }).igreja_id;

    // Evento daqui a 10 dias, para não colidir com o do seed.
    const quando = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    quando.setUTCHours(22, 0, 0, 0);
    dataEvento = quando.toISOString();

    const evento = await criarEvento(lider, idIgreja, `Culto integração ${Date.now()}`, dataEvento);
    idEvento = evento.id;

    const escala = await obterOuCriarEscala(lider, idEvento, idLouvor, idLider);
    idEscala = escala.id;

    const { data: funcao } = await lider
      .from("funcoes")
      .select("id")
      .eq("ministerio_id", idLouvor)
      .eq("nome", "Vocal")
      .single();
    idFuncaoVocal = (funcao as { id: string }).id;
  });

  it("lista uma linha por função do ministério", async () => {
    const linhas = await listarEscalacoesPorFuncao(lider, idEscala, idLouvor);
    expect(linhas.length).toBeGreaterThan(0);
    expect(linhas.map((l) => l.funcaoNome)).toContain("Vocal");
    expect(linhas.every((l) => l.perfilId === null)).toBe(true);
  });

  it("lê as regras que o seed criou e sabe atualizá-las", async () => {
    const originais = await obterRegrasMinisterio(lider, idLouvor);
    expect(originais?.maxEscalasMes).toBe(4);

    const salvas = await salvarRegrasMinisterio(lider, idLouvor, {
      maxEscalasMes: 3,
      intervaloMinDias: 10,
      bloquearConflitoEvento: false,
    });
    expect(salvas.maxEscalasMes).toBe(3);
    expect(salvas.intervaloMinDias).toBe(10);

    // upsert por ministerio_id não pode duplicar a linha
    const { count } = await lider
      .from("regras_ministerio")
      .select("id", { count: "exact", head: true })
      .eq("ministerio_id", idLouvor);
    expect(count).toBe(1);
  });

  it("monta o contexto de validação a partir do banco", async () => {
    const contexto = await obterContextoValidacaoEscalacao(lider, {
      pessoaId: idVocal,
      ministerioId: idLouvor,
      funcaoId: idFuncaoVocal,
      dataEvento: dataEvento.slice(0, 10),
      eventoId: idEvento,
      escalaId: idEscala,
    });

    expect(contexto.pessoaPertenceAoMinisterio).toBe(true);
    expect(contexto.regras?.ministerioId).toBe(idLouvor);
    expect(validarEscalacao(contexto).bloqueios).toHaveLength(0);
  });

  it("bloqueia escalar quem marcou indisponibilidade na data", async () => {
    const dia = dataEvento.slice(0, 10);
    const indisponibilidade = await criarIndisponibilidade(vocal, idVocal, dia, dia, "viagem");

    // O líder do ministério dela precisa enxergar a indisponibilidade.
    const contexto = await obterContextoValidacaoEscalacao(lider, {
      pessoaId: idVocal,
      ministerioId: idLouvor,
      funcaoId: idFuncaoVocal,
      dataEvento: dia,
      eventoId: idEvento,
      escalaId: idEscala,
    });

    expect(contexto.indisponibilidades.length).toBeGreaterThan(0);
    const resultado = validarEscalacao(contexto);
    expect(resultado.bloqueios.map((b) => b.codigo)).toContain("indisponivel_na_data");

    await removerIndisponibilidade(vocal, indisponibilidade.id);
    expect(await listarIndisponibilidades(vocal, idVocal)).toHaveLength(0);
  });

  it("escala, publica, e a pessoa confirma a própria presença", async () => {
    await definirEscalacao(lider, idEscala, idFuncaoVocal, idVocal);

    const linhas = await listarEscalacoesPorFuncao(lider, idEscala, idLouvor);
    const linhaVocal = linhas.find((l) => l.funcaoId === idFuncaoVocal);
    expect(linhaVocal?.perfilId).toBe(idVocal);
    expect(linhaVocal?.confirmacao).toBe("pendente");

    // Antes de publicar, a pessoa não vê a escalação em "minhas escalas".
    expect(await listarMinhasEscalacoes(vocal, idVocal)).toHaveLength(0);

    await publicarEscala(lider, idEscala);

    const minhas = await listarMinhasEscalacoes(vocal, idVocal);
    expect(minhas).toHaveLength(1);
    expect(minhas[0]?.funcaoNome).toBe("Vocal");

    await confirmarPresenca(vocal, minhas[0]!.escalacaoId, "confirmado");
    const depois = await listarMinhasEscalacoes(vocal, idVocal);
    expect(depois[0]?.confirmacao).toBe("confirmado");
  });

  it("a pessoa NÃO consegue confirmar a escalação de outra", async () => {
    await definirEscalacao(lider, idEscala, idFuncaoVocal, idLider);
    const { data: escalacaoDoLider } = await lider
      .from("escalacoes")
      .select("id")
      .eq("escala_id", idEscala)
      .eq("perfil_id", idLider)
      .single();
    const idEscalacaoDoLider = (escalacaoDoLider as { id: string }).id;

    // A policy não estoura erro: ela simplesmente não deixa a linha ser
    // alcançada, e o update vira no-op. O que prova a segurança é o estado.
    await confirmarPresenca(vocal, idEscalacaoDoLider, "recusado");

    const { data: depois } = await lider
      .from("escalacoes")
      .select("confirmacao")
      .eq("id", idEscalacaoDoLider)
      .single();
    expect((depois as { confirmacao: string }).confirmacao).toBe("pendente");

    // devolve a função ao vocal para os testes seguintes
    await definirEscalacao(lider, idEscala, idFuncaoVocal, idVocal);
  });

  it("a pessoa só altera a confirmação da própria linha, não as outras colunas", async () => {
    const minhas = await listarMinhasEscalacoes(vocal, idVocal);
    const minhaEscalacao = minhas[0]!.escalacaoId;

    // Trocar a função da própria escalação é barrado pelo trigger
    // trg_restringe_update_escalacao (RLS filtra linha, não coluna).
    const { data: outraFuncao } = await lider
      .from("funcoes")
      .select("id")
      .eq("ministerio_id", idLouvor)
      .neq("id", idFuncaoVocal)
      .limit(1)
      .single();

    const { error } = await vocal
      .from("escalacoes")
      .update({ funcao_id: (outraFuncao as { id: string }).id })
      .eq("id", minhaEscalacao);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("confirmação");
  });

  it("registra o compartilhamento no histórico de envios", async () => {
    expect(await obterUltimoEnvio(lider, idEscala)).toBeNull();
    await registrarEnvio(lider, idEscala, "whatsapp");

    const envio = await obterUltimoEnvio(lider, idEscala);
    expect(envio?.canal).toBe("whatsapp");
    expect(envio?.enviadoEm).not.toBeNull();
  });
});

describe("repertório e cronograma contra o banco real", () => {
  let lider: SupabaseClient;
  let idLouvor: string;
  let idEscala: string;
  let idMusicaA: string;
  let idMusicaB: string;

  beforeAll(async () => {
    lider = await entrarComo(USUARIOS.liderLouvor);
    idLouvor = await idDoMinisterio(lider, "Louvor");
    const idLider = await idDoPerfil(lider, USUARIOS.liderLouvor);

    const { data: perfil } = await lider.from("perfis").select("igreja_id").eq("id", idLider).single();
    const evento = await criarEvento(
      lider,
      (perfil as { igreja_id: string }).igreja_id,
      `Culto repertório ${Date.now()}`,
      new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
    );
    idEscala = (await obterOuCriarEscala(lider, evento.id, idLouvor, idLider)).id;
  });

  it("guarda e lê as colunas configuráveis em musicas.extras", async () => {
    const campo = await criarCampoMusica(lider, idLouvor, "Quem canta");
    expect(campo.chave).toBe("quem_canta");

    const musica = await criarMusica(lider, idLouvor, {
      titulo: "Grande é o Senhor",
      tom: "G",
      categoria: "Adoração",
      extras: { [campo.chave]: "Maria" },
    });
    idMusicaA = musica.id;

    const doBanco = (await listarMusicas(lider, idLouvor)).find((m) => m.id === idMusicaA);
    expect(doBanco?.extras[campo.chave]).toBe("Maria");
    expect((await listarCamposMusica(lider, idLouvor)).map((c) => c.chave)).toContain("quem_canta");
  });

  it("tirar de uso esconde da lista, mas mantém no repertório antigo", async () => {
    const musica = await criarMusica(lider, idLouvor, { titulo: "Música aposentada" });
    await definirMusicaAtiva(lider, musica.id, false);

    const ativas = await listarMusicas(lider, idLouvor);
    expect(ativas.map((m) => m.id)).not.toContain(musica.id);

    const todas = await listarMusicas(lider, idLouvor, true);
    expect(todas.map((m) => m.id)).toContain(musica.id);
  });

  it("monta o cronograma, reordena e leva tudo para o texto do WhatsApp", async () => {
    await criarCategoriaMusica(lider, idLouvor, "Abertura", 0);
    const segunda = await criarMusica(lider, idLouvor, { titulo: "Bondade de Deus", tom: "D" });
    idMusicaB = segunda.id;

    await adicionarItemCronograma(lider, idEscala, { musicaId: idMusicaA, ordem: 0 });
    let itens = await listarCronograma(lider, idEscala);
    await adicionarItemCronograma(lider, idEscala, {
      musicaId: idMusicaB,
      ordem: proximaOrdem(itens),
    });

    itens = await listarCronograma(lider, idEscala);
    expect(itens.map((i) => i.musicaTitulo)).toEqual(["Grande é o Senhor", "Bondade de Deus"]);

    await atualizarItemCronograma(lider, itens[0]!.id, { tomDoDia: "A", momento: "Abertura" });

    // inverte a ordem e confirma que o banco respeitou
    await salvarOrdemCronograma(lider, [itens[1]!.id, itens[0]!.id]);
    itens = await listarCronograma(lider, idEscala);
    expect(itens.map((i) => i.musicaTitulo)).toEqual(["Bondade de Deus", "Grande é o Senhor"]);

    const texto = gerarTextoEscala({
      ministerioNome: "Louvor",
      eventoTitulo: "Culto",
      dataHora: new Date().toISOString(),
      itens: [],
      cronograma: itens.map((i) => ({
        titulo: i.musicaTitulo,
        tom: i.tomDoDia ?? i.musicaTom,
        momento: i.momento,
      })),
    });

    expect(texto).toContain("1. Bondade de Deus (D)");
    // tom do dia "A" tem de vencer o tom original "G"
    expect(texto).toContain("2. Grande é o Senhor (A · Abertura)");
  });
});

describe("push e lembretes contra o banco real", () => {
  it("cada pessoa só enxerga as próprias inscrições de push", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    const outro = await entrarComo(USUARIOS.projecao1);
    const idVocal = await idDoPerfil(vocal, USUARIOS.vocal1);

    const endpoint = `https://push.example.test/${Date.now()}`;
    const { error } = await vocal.from("push_subscriptions").insert({
      perfil_id: idVocal,
      endpoint,
      p256dh: "chave-publica",
      auth: "segredo",
    });
    expect(error).toBeNull();

    const minhas = await vocal.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint);
    expect(minhas.data).toHaveLength(1);

    const doOutro = await outro.from("push_subscriptions").select("endpoint").eq("endpoint", endpoint);
    expect(doOutro.data).toHaveLength(0);
  });

  it("aceita a query aninhada que a Edge Function de lembretes usa", async () => {
    // Mesmo select de supabase/functions/enviar-lembretes/index.ts. Se o
    // PostgREST recusar o filtro aninhado, é aqui que aparece.
    const lider = await entrarComo(USUARIOS.liderLouvor);
    const idLider = await idDoPerfil(lider, USUARIOS.liderLouvor);
    const { data: perfil } = await lider.from("perfis").select("igreja_id").eq("id", idLider).single();

    const { data, error } = await lider
      .from("escalacoes")
      .select(
        "id, perfil_id, funcoes(nome), escalas!inner(status, ministerios!inner(nome), eventos!inner(titulo, data_hora, igreja_id))",
      )
      .eq("escalas.status", "publicada")
      .eq("escalas.eventos.igreja_id", (perfil as { igreja_id: string }).igreja_id)
      .gte("escalas.eventos.data_hora", new Date(0).toISOString())
      .lt("escalas.eventos.data_hora", new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString())
      .neq("confirmacao", "recusado");

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    // O fluxo anterior publicou uma escala com o vocal confirmado.
    expect((data ?? []).length).toBeGreaterThan(0);
  });
});
