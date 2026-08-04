import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CHAVE_ANON, criarContaNova, SENHA_SEED, URL_SUPABASE } from "./ambiente.js";
import {
  adicionarMembroExistente,
  contarMeuHistorico,
  criarConvite,
  criarEvento,
  criarFuncao,
  criarIgreja,
  definirEscalacao,
  definirPapelDoMembro,
  excluirMinhaConta,
  listarMembrosDoMinisterio,
  listarPerfisDaIgreja,
  obterMeuPerfil,
  obterOuCriarEscala,
  obterRelatorioParticipacao,
  publicarEscala,
  usarConvite,
} from "../index.js";

/**
 * Excluir a própria conta.
 *
 * Monta uma igreja nova a cada execução, como os outros arquivos da Etapa 6:
 * aqui se apagam contas de verdade, e mexer na "Igreja Exemplo" do seed
 * quebraria os números que `fluxo` confere.
 */

const DATA_EVENTO = "2027-09-12T22:00:00.000Z";
const MES_DO_EVENTO = { inicio: "2027-09-01", fim: "2027-09-30" };

/** Tenta entrar de novo com o e-mail e a senha da conta. */
async function conseguiEntrar(email: string): Promise<boolean> {
  const client = createClient(URL_SUPABASE, CHAVE_ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password: SENHA_SEED });
  return !error && !!data.session;
}

describe("Excluir a própria conta", () => {
  let admin: SupabaseClient;
  let idIgreja: string;
  let idMinisterio: string;
  let idPerfilAdmin: string;

  beforeAll(async () => {
    admin = (await criarContaNova("Ana Administradora")).client;
    idIgreja = await criarIgreja(admin, `Igreja Exclusao ${Date.now()}`, "America/Sao_Paulo");
    idPerfilAdmin = (await obterMeuPerfil(admin))!.id;

    const { data, error } = await admin
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: "Louvor" })
      .select("id")
      .single();
    if (error) throw error;
    idMinisterio = (data as { id: string }).id;

    await criarFuncao(admin, idMinisterio, "Vocal");
  });

  async function entrarNaIgreja(nome: string, papel: "membro" | "lider" = "membro") {
    const convite = await criarConvite(admin, { ministerioId: idMinisterio, papel });
    const conta = await criarContaNova(nome);
    await usarConvite(conta.client, convite.codigo);
    return conta;
  }

  // -------------------------------------------------------------------------
  // Sem histórico: some de vez
  // -------------------------------------------------------------------------

  it("quem nunca serviu some de vez, e nao consegue mais entrar", async () => {
    const conta = await entrarNaIgreja("Bruno Passageiro");
    const idPerfil = (await obterMeuPerfil(conta.client))!.id;

    expect(await contarMeuHistorico(conta.client)).toBe(0);
    expect(await excluirMinhaConta(conta.client)).toBe("excluida");

    const perfis = await listarPerfisDaIgreja(admin, idIgreja, true);
    expect(perfis.map((perfil) => perfil.id)).not.toContain(idPerfil);

    const membros = await listarMembrosDoMinisterio(admin, idMinisterio);
    expect(membros.map((membro) => membro.perfilId)).not.toContain(idPerfil);

    expect(await conseguiEntrar(conta.email)).toBe(false);
  });

  it("quem criou conta e nunca entrou em igreja nenhuma tambem some", async () => {
    const conta = await criarContaNova("Carla Sem Igreja");
    expect(await obterMeuPerfil(conta.client)).toBeNull();

    expect(await excluirMinhaConta(conta.client)).toBe("excluida");
    expect(await conseguiEntrar(conta.email)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Com histórico: o login morre, o relatório não muda
  // -------------------------------------------------------------------------

  it("quem ja serviu perde o login, mas o relatorio continua igual", async () => {
    const conta = await entrarNaIgreja("Davi Vocalista");
    const idPerfil = (await obterMeuPerfil(conta.client))!.id;

    const evento = await criarEvento(admin, idIgreja, "Culto de setembro", DATA_EVENTO);
    const escala = await obterOuCriarEscala(admin, evento.id, idMinisterio, idPerfilAdmin);
    const { data: funcoes } = await admin
      .from("funcoes")
      .select("id")
      .eq("ministerio_id", idMinisterio)
      .limit(1);
    const idFuncao = (funcoes as { id: string }[])[0]!.id;

    await definirEscalacao(admin, escala.id, idFuncao, idPerfil);
    await publicarEscala(admin, escala.id);

    const janela = {
      ministerioId: idMinisterio,
      dataInicio: MES_DO_EVENTO.inicio,
      dataFim: MES_DO_EVENTO.fim,
      fusoHorario: "America/Sao_Paulo",
    };
    const antes = await obterRelatorioParticipacao(admin, janela);
    expect(antes.totalEscalacoes).toBe(1);

    expect(await contarMeuHistorico(conta.client)).toBeGreaterThan(0);
    expect(await excluirMinhaConta(conta.client)).toBe("arquivada");

    // O ponto do arquivamento: apagar o perfil levaria a escalação junto, em
    // cascade, e o relatório de setembro passaria a dizer zero.
    const depois = await obterRelatorioParticipacao(admin, janela);
    expect(depois.totalEscalacoes).toBe(1);
    expect(depois.linhas.find((linha) => linha.perfilId === idPerfil)?.nome).toBe("Davi Vocalista");

    // Some das listas do dia a dia e do ministério.
    const ativos = await listarPerfisDaIgreja(admin, idIgreja);
    expect(ativos.map((perfil) => perfil.id)).not.toContain(idPerfil);
    const membros = await listarMembrosDoMinisterio(admin, idMinisterio);
    expect(membros.map((membro) => membro.perfilId)).not.toContain(idPerfil);

    // E o login morreu de verdade.
    expect(await conseguiEntrar(conta.email)).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Guardas
  // -------------------------------------------------------------------------

  it("o unico lider de um ministerio com gente nao consegue sair", async () => {
    const lider = await entrarNaIgreja("Elias Lider", "lider");
    await entrarNaIgreja("Fabio Membro");

    await expect(excluirMinhaConta(lider.client)).rejects.toThrow(/único líder de Louvor/i);

    // Continua tudo no lugar: nada pela metade.
    expect(await obterMeuPerfil(lider.client)).not.toBeNull();
    expect(await conseguiEntrar(lider.email)).toBe(true);
  });

  it("o unico administrador da igreja nao consegue sair", async () => {
    await expect(excluirMinhaConta(admin)).rejects.toThrow(/único administrador/i);
    expect(await obterMeuPerfil(admin)).not.toBeNull();
  });

  it("depois de promover outra pessoa a lider, a saida e liberada", async () => {
    // Ministério próprio: os testes acima deixaram outros líderes no "Louvor",
    // e aí o bloqueio que este caso quer exercitar nem chegaria a acontecer.
    const { data, error } = await admin
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: `Sucessao ${Date.now()}` })
      .select("id")
      .single();
    if (error) throw error;
    const idSucessao = (data as { id: string }).id;

    const conviteLider = await criarConvite(admin, { ministerioId: idSucessao, papel: "lider" });
    const primeiro = await criarContaNova("Gustavo Lider");
    await usarConvite(primeiro.client, conviteLider.codigo);

    const conviteMembro = await criarConvite(admin, { ministerioId: idSucessao, papel: "membro" });
    const segundo = await criarContaNova("Helena Substituta");
    await usarConvite(segundo.client, conviteMembro.codigo);

    await expect(excluirMinhaConta(primeiro.client)).rejects.toThrow(/único líder/i);

    const membros = await listarMembrosDoMinisterio(admin, idSucessao);
    const vinculo = membros.find((membro) => membro.perfilId === segundo.id);
    await definirPapelDoMembro(admin, vinculo!.id, "lider");

    expect(await excluirMinhaConta(primeiro.client)).toBe("excluida");
    expect(await conseguiEntrar(primeiro.email)).toBe(false);
  });

  it("quem esta sozinho no ministerio pode sair, deixando-o vazio", async () => {
    const { data, error } = await admin
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: `Solo ${Date.now()}` })
      .select("id")
      .single();
    if (error) throw error;
    const idSolo = (data as { id: string }).id;

    const convite = await criarConvite(admin, { ministerioId: idSolo, papel: "lider" });
    const solitario = await criarContaNova("Ivo Sozinho");
    await usarConvite(solitario.client, convite.codigo);

    // Ninguém depende dele, então o trigger do último líder não deve atrapalhar.
    expect(await excluirMinhaConta(solitario.client)).toBe("excluida");
    expect(await listarMembrosDoMinisterio(admin, idSolo)).toHaveLength(0);
  });

  it("a igreja some junto quando a ultima pessoa dela sai", async () => {
    const sozinha = await criarContaNova("Joana Fundadora");
    const idIgrejaDela = await criarIgreja(sozinha.client, `Igreja Solo ${Date.now()}`);

    expect(await excluirMinhaConta(sozinha.client)).toBe("excluida");

    // Consultado pelo admin de outra igreja: some para todo mundo, não é RLS
    // escondendo — a linha deixou de existir.
    const { data } = await admin.from("igrejas").select("id").eq("id", idIgrejaDela);
    expect(data ?? []).toHaveLength(0);
  });

  it("adicionar de novo alguem que saiu nao ressuscita a conta antiga", async () => {
    const conta = await entrarNaIgreja("Lia Temporaria");
    const idPerfil = (await obterMeuPerfil(conta.client))!.id;
    await excluirMinhaConta(conta.client);

    await expect(adicionarMembroExistente(admin, idMinisterio, idPerfil)).rejects.toThrow();
  });
});
