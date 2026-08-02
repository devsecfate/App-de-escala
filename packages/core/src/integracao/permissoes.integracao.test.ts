import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { entrarComo, idDoMinisterio, idDoPerfil, USUARIOS } from "./ambiente.js";
import { criarEvento, obterOuCriarEscala, publicarEscala } from "../index.js";

/**
 * "O teste mais importante" segundo planejamento/planejamento.md: com dois
 * usuários reais, confirmar que o líder do ministério A não consegue editar a
 * escala do ministério B — nem pela UI, nem chamando a API do Supabase direto.
 *
 * Por isso aqui vamos direto na API, sem passar pelas telas.
 */
describe("RLS — isolamento entre ministérios", () => {
  let louvor: SupabaseClient;
  let tecnologia: SupabaseClient;
  let idLouvor: string;
  let idTecnologia: string;
  let idLiderLouvor: string;
  let idEvento: string;

  beforeAll(async () => {
    louvor = await entrarComo(USUARIOS.liderLouvor);
    tecnologia = await entrarComo(USUARIOS.liderTecnologia);

    idLouvor = await idDoMinisterio(louvor, "Louvor");
    idTecnologia = await idDoMinisterio(louvor, "Tecnologia (projeção e luz)");
    idLiderLouvor = await idDoPerfil(louvor, USUARIOS.liderLouvor);

    const evento = await criarEvento(
      louvor,
      (await louvor.from("perfis").select("igreja_id").eq("id", idLiderLouvor).single()).data!
        .igreja_id as string,
      `Culto de teste ${Date.now()}`,
      new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    );
    idEvento = evento.id;
  });

  it("o líder monta a escala do próprio ministério", async () => {
    const escala = await obterOuCriarEscala(louvor, idEvento, idLouvor, idLiderLouvor);
    expect(escala.ministerioId).toBe(idLouvor);
    expect(escala.status).toBe("rascunho");
  });

  it("o líder do Louvor NÃO cria escala no ministério da Tecnologia", async () => {
    await expect(obterOuCriarEscala(louvor, idEvento, idTecnologia, idLiderLouvor)).rejects.toThrow();
  });

  it("o líder do Louvor NÃO escala ninguém numa escala da Tecnologia", async () => {
    const idLiderTec = await idDoPerfil(tecnologia, USUARIOS.liderTecnologia);
    const escalaTec = await obterOuCriarEscala(tecnologia, idEvento, idTecnologia, idLiderTec);

    const { data: funcao } = await tecnologia
      .from("funcoes")
      .select("id")
      .eq("ministerio_id", idTecnologia)
      .limit(1)
      .single();

    const { error } = await louvor.from("escalacoes").insert({
      escala_id: escalaTec.id,
      funcao_id: (funcao as { id: string }).id,
      perfil_id: idLiderLouvor,
    });

    expect(error).not.toBeNull();
  });

  it("o líder do Louvor NÃO publica a escala da Tecnologia", async () => {
    const idLiderTec = await idDoPerfil(tecnologia, USUARIOS.liderTecnologia);
    const escalaTec = await obterOuCriarEscala(tecnologia, idEvento, idTecnologia, idLiderTec);

    // O update não estoura erro: a policy simplesmente não deixa a linha ser
    // alcançada. O que importa é o estado no banco continuar 'rascunho'.
    await publicarEscala(louvor, escalaTec.id).catch(() => undefined);

    const { data } = await tecnologia.from("escalas").select("status").eq("id", escalaTec.id).single();
    expect((data as { status: string }).status).toBe("rascunho");
  });

  it("membro comum NÃO cria função em ministério nenhum", async () => {
    const vocal = await entrarComo(USUARIOS.vocal1);
    const { error } = await vocal
      .from("funcoes")
      .insert({ ministerio_id: idLouvor, nome: "Função pirata" });
    expect(error).not.toBeNull();
  });

  it("rascunho de um ministério não vaza para membro de outro", async () => {
    const projecao = await entrarComo(USUARIOS.projecao1);
    const escala = await obterOuCriarEscala(louvor, idEvento, idLouvor, idLiderLouvor);

    const { data } = await projecao.from("escalas").select("id").eq("id", escala.id).maybeSingle();
    expect(data).toBeNull();
  });
});
