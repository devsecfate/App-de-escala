import { describe, expect, it } from "vitest";
import { decidirExclusao } from "./exclusao.js";

describe("decidirExclusao", () => {
  it("exclui de vez o que nunca foi usado", () => {
    const decisao = decidirExclusao({ oQue: "a função", nome: "Guitarr", historico: 0 });

    expect(decisao.arquivar).toBe(false);
    expect(decisao.titulo).toContain("Excluir");
    expect(decisao.rotuloConfirmar).toBe("Excluir de vez");
    expect(decisao.descricao).toContain("nunca foi usado");
  });

  it("arquiva o que já tem histórico e diz quanto", () => {
    const decisao = decidirExclusao({ oQue: "o ministério", nome: "Louvor", historico: 12 });

    expect(decisao.arquivar).toBe(true);
    expect(decisao.titulo).toContain("Arquivar");
    // O número tem que estar na frase: é ele que justifica não excluir.
    expect(decisao.descricao).toContain("12 escalas");
    expect(decisao.descricao).toContain("desarquivar");
  });

  it("concorda no singular quando o histórico é de um só", () => {
    const decisao = decidirExclusao({ oQue: "a função", nome: "Baixo", historico: 1 });

    expect(decisao.descricao).toContain("1 escala.");
    expect(decisao.descricao).not.toContain("1 escalas");
  });

  it("usa a unidade de histórico que a tela informar", () => {
    const decisao = decidirExclusao({
      oQue: "a música",
      nome: "Grande é o Senhor",
      historico: 3,
      unidadeHistorico: "cronogramas",
    });

    expect(decisao.descricao).toContain("3 cronogramas");
  });

  it("arquiva mesmo sem histórico quando a pessoa não pode excluir de vez", () => {
    // É o caso do líder num evento: a policy de DELETE em `eventos` é só do
    // admin, então oferecer "excluir de vez" viraria erro de permissão.
    const decisao = decidirExclusao({
      oQue: "o evento",
      nome: "Ensaio de quinta",
      historico: 0,
      podeExcluirDeVez: false,
    });

    expect(decisao.arquivar).toBe(true);
    expect(decisao.rotuloConfirmar).toBe("Arquivar");
    expect(decisao.descricao).toContain("administrador");
  });

  it("põe o nome entre aspas para não se confundir com o resto da frase", () => {
    const decisao = decidirExclusao({ oQue: "o evento", nome: "Culto de domingo", historico: 0 });

    expect(decisao.titulo).toBe("Excluir “Culto de domingo”?");
  });
});
