import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarContaNova } from "./ambiente.js";
import {
  criarConvite,
  criarIgreja,
  definirPapelDoMembro,
  definirPapelGlobal,
  definirPerfilAtivo,
  excluirMinhaConta,
  listarPessoasDaIgreja,
  obterMeuPerfil,
  usarConvite,
  type PessoaDaIgreja,
} from "../index.js";

/**
 * Promover alguém a administrador da igreja, e a rede de proteção do outro
 * lado: a igreja não pode ficar sem nenhum administrador.
 *
 * Igreja própria a cada execução, como os demais arquivos da Etapa 6.
 */
describe("Promover a administrador", () => {
  let admin: SupabaseClient;
  let idIgreja: string;
  let idMinisterio: string;
  let idPerfilAdmin: string;

  beforeAll(async () => {
    admin = (await criarContaNova("Ana Administradora")).client;
    idIgreja = await criarIgreja(admin, `Igreja Promover ${Date.now()}`, "America/Sao_Paulo");
    idPerfilAdmin = (await obterMeuPerfil(admin))!.id;

    const { data, error } = await admin
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: "Louvor" })
      .select("id")
      .single();
    if (error) throw error;
    idMinisterio = (data as { id: string }).id;
  });

  async function entrar(nome: string, papel: "membro" | "lider" = "membro") {
    const convite = await criarConvite(admin, { ministerioId: idMinisterio, papel });
    const conta = await criarContaNova(nome);
    await usarConvite(conta.client, convite.codigo);
    return conta;
  }

  function acharPessoa(pessoas: PessoaDaIgreja[], id: string): PessoaDaIgreja {
    const pessoa = pessoas.find((atual) => atual.id === id);
    if (!pessoa) throw new Error(`Pessoa ${id} não voltou na lista da igreja.`);
    return pessoa;
  }

  it("lista todo mundo da igreja, com os ministerios de cada um", async () => {
    const membro = await entrar("Bruno Membro");

    const pessoas = await listarPessoasDaIgreja(admin);
    expect(pessoas.length).toBeGreaterThanOrEqual(2);

    const eu = acharPessoa(pessoas, idPerfilAdmin);
    expect(eu.papelGlobal).toBe("admin");
    // A administradora criou a igreja mas não entrou em ministério nenhum —
    // e é justamente esse tipo de pessoa que sumia da tela antiga.
    expect(eu.ministerios).toHaveLength(0);

    const dele = acharPessoa(pessoas, membro.id);
    expect(dele.ministerios).toHaveLength(1);
    expect(dele.ministerios[0]!.ministerioNome).toBe("Louvor");
    expect(dele.ministerios[0]!.papel).toBe("membro");
  });

  it("promove a administrador e a pessoa passa a poder administrar", async () => {
    const membro = await entrar("Carla Promovida");

    // Antes: não é admin, então não cria ministério.
    const tentativa = await membro.client
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: "Nao deveria existir" })
      .select("id");
    expect(tentativa.error).not.toBeNull();

    await definirPapelGlobal(admin, membro.id, "admin");

    expect(acharPessoa(await listarPessoasDaIgreja(admin), membro.id).papelGlobal).toBe("admin");
    expect((await obterMeuPerfil(membro.client))?.papelGlobal).toBe("admin");

    // Depois: o poder é real, não só o rótulo.
    const agora = await membro.client
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: `Criado pela promovida ${Date.now()}` })
      .select("id");
    expect(agora.error).toBeNull();
  });

  it("membro comum nao consegue promover ninguem, nem a si mesmo", async () => {
    const membro = await entrar("Diego Ambicioso");

    await expect(definirPapelGlobal(membro.client, membro.id, "admin")).rejects.toThrow();
    await expect(definirPapelGlobal(membro.client, idPerfilAdmin, "membro")).rejects.toThrow();

    expect((await obterMeuPerfil(membro.client))?.papelGlobal).toBe("membro");
  });

  it("a igreja nao pode ficar sem nenhum administrador", async () => {
    const sozinha = await criarContaNova("Elza Fundadora");
    await criarIgreja(sozinha.client, `Igreja Unica ${Date.now()}`);
    const perfilDela = (await obterMeuPerfil(sozinha.client))!;

    await expect(definirPapelGlobal(sozinha.client, perfilDela.id, "membro")).rejects.toThrow(
      /pelo menos um administrador/i,
    );
    await expect(definirPerfilAtivo(sozinha.client, perfilDela.id, false)).rejects.toThrow(
      /pelo menos um administrador/i,
    );

    expect((await obterMeuPerfil(sozinha.client))?.papelGlobal).toBe("admin");
  });

  it("com dois administradores, um pode se rebaixar", async () => {
    const primeira = await criarContaNova("Fabi Primeira");
    const idIgrejaDupla = await criarIgreja(primeira.client, `Igreja Dupla ${Date.now()}`);
    const idPrimeira = (await obterMeuPerfil(primeira.client))!.id;

    const { data, error } = await primeira.client
      .from("ministerios")
      .insert({ igreja_id: idIgrejaDupla, nome: "Recepção" })
      .select("id")
      .single();
    if (error) throw error;

    const convite = await criarConvite(primeira.client, {
      ministerioId: (data as { id: string }).id,
      papel: "membro",
    });
    const segunda = await criarContaNova("Gabi Segunda");
    await usarConvite(segunda.client, convite.codigo);

    await definirPapelGlobal(primeira.client, segunda.id, "admin");
    await definirPapelGlobal(primeira.client, idPrimeira, "membro");

    expect((await obterMeuPerfil(primeira.client))?.papelGlobal).toBe("membro");
    expect((await obterMeuPerfil(segunda.client))?.papelGlobal).toBe("admin");

    // E agora a segunda é que não pode sair sozinha.
    await expect(definirPapelGlobal(segunda.client, segunda.id, "membro")).rejects.toThrow(
      /pelo menos um administrador/i,
    );
  });

  it("promover a administrador destrava a exclusao da conta do unico admin", async () => {
    // O caso que motivou a tela: `excluir_minha_conta` manda promover outra
    // pessoa, e até agora não havia como.
    const dona = await criarContaNova("Helena Dona");
    const idIgrejaDela = await criarIgreja(dona.client, `Igreja Sucessao ${Date.now()}`);

    const { data, error } = await dona.client
      .from("ministerios")
      .insert({ igreja_id: idIgrejaDela, nome: "Mídia" })
      .select("id")
      .single();
    if (error) throw error;

    const convite = await criarConvite(dona.client, {
      ministerioId: (data as { id: string }).id,
      papel: "membro",
    });
    const herdeira = await criarContaNova("Iris Herdeira");
    await usarConvite(herdeira.client, convite.codigo);

    await expect(excluirMinhaConta(dona.client)).rejects.toThrow(/único administrador/i);

    await definirPapelGlobal(dona.client, herdeira.id, "admin");

    expect(await excluirMinhaConta(dona.client)).toBe("excluida");
    expect((await obterMeuPerfil(herdeira.client))?.papelGlobal).toBe("admin");
  });

  it("promover a lider de ministerio funciona pela lista da igreja", async () => {
    const membro = await entrar("Joana Vocal");

    const antes = acharPessoa(await listarPessoasDaIgreja(admin), membro.id);
    expect(antes.ministerios[0]!.papel).toBe("membro");

    // É o `vinculoId` que a tela passa adiante — o id da linha em
    // `membros_ministerio`, não o do perfil nem o do ministério.
    await definirPapelDoMembro(admin, antes.ministerios[0]!.vinculoId, "lider");

    const depois = acharPessoa(await listarPessoasDaIgreja(admin), membro.id);
    expect(depois.ministerios[0]!.papel).toBe("lider");
  });
});
