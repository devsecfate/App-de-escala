import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { criarContaNova, entrarComo, idDoMinisterio, idDoPerfil, USUARIOS } from "./ambiente.js";
import {
  cancelarConvite,
  criarConvite,
  criarIgreja,
  listarConvites,
  obterMeuPerfil,
  usarConvite,
  type Convite,
} from "../index.js";

/**
 * Entrar na igreja por código de convite (Etapa 6.1).
 *
 * Estes testes montam uma igreja própria a cada execução, em vez de usar a
 * "Igreja Exemplo" do seed: entrar por convite cria perfis e vínculos, e
 * despejar gente nova no ministério de Louvor do seed mudaria os números que
 * `fluxo` e `relatorio` conferem. Como consequência, este arquivo pode rodar
 * várias vezes seguidas sem `supabase db reset`.
 */
describe("Convites — criar conta e entrar na igreja", () => {
  let admin: SupabaseClient;
  let idIgreja: string;
  let idMinisterio: string;

  // Uma conta só para apanhar em todos os casos de código inválido: como
  // nenhuma tentativa dá certo, ela continua sem perfil e serve para a
  // seguinte. Cada conta a mais é um sign-up a mais contra o limite do GoTrue.
  let candidato: SupabaseClient;

  beforeAll(async () => {
    const conta = await criarContaNova("Ana Administradora");
    admin = conta.client;

    idIgreja = await criarIgreja(admin, `Igreja de Teste ${Date.now()}`, "America/Sao_Paulo");

    const { data, error } = await admin
      .from("ministerios")
      .insert({ igreja_id: idIgreja, nome: "Louvor de teste" })
      .select("id")
      .single();
    if (error) throw error;
    idMinisterio = (data as { id: string }).id;

    candidato = (await criarContaNova("Carlos Candidato")).client;
  });

  it("o nome do cadastro vira o nome do perfil do administrador", async () => {
    // A versão antiga de `criar_igreja` lia `auth.jwt() ->> 'name'`, que nunca
    // existe — o nome fica em user_metadata. O coalesce caía sempre no e-mail
    // e TODO administrador nascia com nome = e-mail.
    const perfil = await obterMeuPerfil(admin);
    expect(perfil?.nome).toBe("Ana Administradora");
    expect(perfil?.papelGlobal).toBe("admin");
    expect(perfil?.igrejaId).toBe(idIgreja);
  });

  it("quem usa o código entra na igreja e já cai no ministério certo", async () => {
    const convite = await criarConvite(admin, {
      ministerioId: idMinisterio,
      papel: "lider",
      validoPorDias: 7,
    });

    expect(convite.codigo).toHaveLength(8);
    expect(convite.igrejaId).toBe(idIgreja);
    // O alfabeto não tem O, 0, I, 1 nem L: são os que a pessoa lê errado.
    expect(convite.codigo).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);

    const convidado = await criarContaNova("Bia Convidada");
    // Digitado como a pessoa digita: minúscula e com o hífen da exibição.
    const comoDigitado = `${convite.codigo.slice(0, 4)}-${convite.codigo.slice(4)}`.toLowerCase();
    const igrejaRetornada = await usarConvite(convidado.client, comoDigitado);
    expect(igrejaRetornada).toBe(idIgreja);

    const perfil = await obterMeuPerfil(convidado.client);
    expect(perfil?.igrejaId).toBe(idIgreja);
    expect(perfil?.nome).toBe("Bia Convidada");
    expect(perfil?.papelGlobal).toBe("membro");

    const { data: vinculo } = await convidado.client
      .from("membros_ministerio")
      .select("papel, ativo")
      .eq("ministerio_id", idMinisterio)
      .eq("perfil_id", convidado.id)
      .single();
    expect(vinculo).toMatchObject({ papel: "lider", ativo: true });

    const [doBanco] = await listarConvites(admin, idMinisterio);
    expect(doBanco?.usos).toBe(1);

    // E quem entrou como líder já pode gerar convite do próprio ministério.
    const conviteDoLider = await criarConvite(convidado.client, { ministerioId: idMinisterio });
    expect(conviteDoLider.criadoPor).toBe(convidado.id);
  });

  it("código que não existe fala isso, em português", async () => {
    await expect(usarConvite(candidato, "ZZZZ-9999")).rejects.toThrow(/não encontrado/i);
  });

  it("código cancelado fala que foi cancelado", async () => {
    const convite = await criarConvite(admin, { ministerioId: idMinisterio });
    await cancelarConvite(admin, convite.id);

    await expect(usarConvite(candidato, convite.codigo)).rejects.toThrow(/cancelado/i);
  });

  it("código vencido fala que venceu", async () => {
    const convite = await criarConvite(admin, { ministerioId: idMinisterio });
    const { error } = await admin
      .from("convites")
      .update({ expira_em: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", convite.id);
    expect(error).toBeNull();

    await expect(usarConvite(candidato, convite.codigo)).rejects.toThrow(/venceu/i);
  });

  it("código esgotado fala que acabaram os usos", async () => {
    const convite = await criarConvite(admin, { ministerioId: idMinisterio, usosMax: 1 });

    const primeiro = await criarContaNova("Davi Primeiro");
    await usarConvite(primeiro.client, convite.codigo);

    await expect(usarConvite(candidato, convite.codigo)).rejects.toThrow(/número de vezes/i);
  });

  it("quem já faz parte de uma igreja não usa convite nenhum", async () => {
    const convite = await criarConvite(admin, { ministerioId: idMinisterio });
    await expect(usarConvite(admin, convite.codigo)).rejects.toThrow(/já faz parte/i);
  });

  it("membro comum não gera convite para o ministério que não lidera", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    const idLouvorDoSeed = await idDoMinisterio(vocal, "Louvor");

    await expect(criarConvite(vocal, { ministerioId: idLouvorDoSeed })).rejects.toThrow(/líder/i);
  });

  it("ninguém gera convite para ministério de outra igreja", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    await expect(criarConvite(vocal, { ministerioId: idMinisterio })).rejects.toThrow(
      /não encontrado/i,
    );
  });

  it("convite de uma igreja não aparece para líder de outra", async () => {
    const conviteDaMinha = await criarConvite(admin, { ministerioId: idMinisterio });

    const liderDoSeed = await entrarComo(USUARIOS.liderLouvor);
    const visiveis: Convite[] = await listarConvites(liderDoSeed);

    expect(visiveis.some((convite) => convite.id === conviteDaMinha.id)).toBe(false);
  });
});

/**
 * O furo que a Etapa 6 fecha: `perfis_update_propria` libera UPDATE na própria
 * linha, e RLS filtra linha, não coluna — um PATCH com {"papel_global":"admin"}
 * dava a igreja inteira para qualquer membro.
 */
describe("perfis — trigger que impede virar admin sozinho", () => {
  it("membro NÃO se promove a admin", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    const idVocal = await idDoPerfil(vocal, USUARIOS.vocal1);

    const { error } = await vocal
      .from("perfis")
      .update({ papel_global: "admin" })
      .eq("id", idVocal);

    expect(error).not.toBeNull();

    const depois = await obterMeuPerfil(vocal);
    expect(depois?.papelGlobal).toBe("membro");
  });

  it("membro NÃO se desativa nem se muda de igreja pelo mesmo caminho", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    const idVocal = await idDoPerfil(vocal, USUARIOS.vocal1);

    const { error: erroAtivo } = await vocal
      .from("perfis")
      .update({ ativo: false })
      .eq("id", idVocal);
    expect(erroAtivo).not.toBeNull();

    const { error: erroIgreja } = await vocal
      .from("perfis")
      .update({ igreja_id: crypto.randomUUID() })
      .eq("id", idVocal);
    expect(erroIgreja).not.toBeNull();
  });

  it("mas continua podendo corrigir o próprio nome e telefone", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    const idVocal = await idDoPerfil(vocal, USUARIOS.vocal1);

    const { error } = await vocal
      .from("perfis")
      .update({ nome: "Vocal Um", telefone: "11999990000" })
      .eq("id", idVocal);

    expect(error).toBeNull();
  });

  it("o admin da igreja continua promovendo quem ele quiser", async () => {
    const admin = await entrarComo(USUARIOS.admin);
    const idProjecao = await idDoPerfil(admin, USUARIOS.projecao1);

    const { error: promovendo } = await admin
      .from("perfis")
      .update({ papel_global: "admin" })
      .eq("id", idProjecao);
    expect(promovendo).toBeNull();

    // Devolve como estava: os outros arquivos da suíte contam com este perfil
    // sendo um membro comum.
    const { error: voltando } = await admin
      .from("perfis")
      .update({ papel_global: "membro" })
      .eq("id", idProjecao);
    expect(voltando).toBeNull();
  });
});
