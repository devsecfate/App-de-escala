import { describe, expect, it } from "vitest";
import { resumirParticipacoes, type ParticipacaoBruta, type PessoaDoMinisterio } from "./relatorio.js";

const MARIA: PessoaDoMinisterio = { perfilId: "p-maria", nome: "Maria Silva" };
const JOAO: PessoaDoMinisterio = { perfilId: "p-joao", nome: "João Souza" };
const ANA: PessoaDoMinisterio = { perfilId: "p-ana", nome: "Ana Lima" };

function participacao(
  pessoa: PessoaDoMinisterio,
  dataHora: string,
  extras: Partial<ParticipacaoBruta> = {},
): ParticipacaoBruta {
  return {
    perfilId: pessoa.perfilId,
    nome: pessoa.nome,
    dataHora,
    funcaoNome: "Vocal",
    confirmacao: "confirmado",
    ...extras,
  };
}

describe("resumirParticipacoes", () => {
  it("conta quantas vezes cada pessoa serviu", () => {
    const relatorio = resumirParticipacoes(
      [MARIA, JOAO],
      [
        participacao(MARIA, "2026-08-02T22:00:00Z"),
        participacao(MARIA, "2026-08-09T22:00:00Z"),
        participacao(JOAO, "2026-08-16T22:00:00Z"),
      ],
    );

    expect(relatorio.linhas.map((l) => [l.nome, l.vezes])).toEqual([
      ["Maria Silva", 2],
      ["João Souza", 1],
    ]);
    expect(relatorio.totalEscalacoes).toBe(3);
  });

  it("mostra quem não serviu nenhuma vez", () => {
    const relatorio = resumirParticipacoes([MARIA, ANA], [participacao(MARIA, "2026-08-02T22:00:00Z")]);

    const ana = relatorio.linhas.find((l) => l.perfilId === ANA.perfilId);
    expect(ana?.vezes).toBe(0);
    expect(ana?.ultimaVez).toBeNull();
    expect(relatorio.pessoasSemServir).toBe(1);
    expect(relatorio.pessoasQueServiram).toBe(1);
  });

  it("ordena da mais escalada para a menos, e empate pelo nome", () => {
    const relatorio = resumirParticipacoes(
      [MARIA, JOAO, ANA],
      [
        participacao(MARIA, "2026-08-02T22:00:00Z"),
        participacao(JOAO, "2026-08-09T22:00:00Z"),
        participacao(ANA, "2026-08-16T22:00:00Z"),
        participacao(ANA, "2026-08-23T22:00:00Z"),
      ],
    );

    // Ana tem 2; Maria e João têm 1 e desempatam por nome (acento não pode
    // jogar "João" para o fim da lista).
    expect(relatorio.linhas.map((l) => l.nome)).toEqual(["Ana Lima", "João Souza", "Maria Silva"]);
  });

  it("separa confirmadas, recusadas e pendentes", () => {
    const relatorio = resumirParticipacoes(
      [MARIA],
      [
        participacao(MARIA, "2026-08-02T22:00:00Z", { confirmacao: "confirmado" }),
        participacao(MARIA, "2026-08-09T22:00:00Z", { confirmacao: "recusado" }),
        participacao(MARIA, "2026-08-16T22:00:00Z", { confirmacao: "pendente" }),
      ],
    );

    const maria = relatorio.linhas[0]!;
    expect(maria.vezes).toBe(3);
    expect(maria.confirmadas).toBe(1);
    expect(maria.recusadas).toBe(1);
    expect(maria.pendentes).toBe(1);
  });

  it("guarda a última vez que a pessoa serviu, mesmo fora de ordem", () => {
    const relatorio = resumirParticipacoes(
      [MARIA],
      [
        participacao(MARIA, "2026-08-23T22:00:00Z"),
        participacao(MARIA, "2026-08-02T22:00:00Z"),
        participacao(MARIA, "2026-08-09T22:00:00Z"),
      ],
    );

    expect(relatorio.linhas[0]!.ultimaVez).toBe("2026-08-23T22:00:00Z");
  });

  it("lista as funções sem repetir", () => {
    const relatorio = resumirParticipacoes(
      [MARIA],
      [
        participacao(MARIA, "2026-08-02T22:00:00Z", { funcaoNome: "Vocal" }),
        participacao(MARIA, "2026-08-09T22:00:00Z", { funcaoNome: "Vocal" }),
        participacao(MARIA, "2026-08-16T22:00:00Z", { funcaoNome: "Teclado" }),
      ],
    );

    expect(relatorio.linhas[0]!.funcoes).toEqual(["Teclado", "Vocal"]);
  });

  it("mantém na lista quem serviu e depois saiu do ministério", () => {
    // Sem isso a soma das linhas não fecharia com o total de escalações.
    const relatorio = resumirParticipacoes([MARIA], [
      participacao(MARIA, "2026-08-02T22:00:00Z"),
      participacao(JOAO, "2026-08-09T22:00:00Z"),
    ]);

    const joao = relatorio.linhas.find((l) => l.perfilId === JOAO.perfilId);
    expect(joao?.vezes).toBe(1);
    expect(joao?.aindaNoMinisterio).toBe(false);
    expect(relatorio.linhas.reduce((soma, l) => soma + l.vezes, 0)).toBe(relatorio.totalEscalacoes);
  });

  it("calcula a média só entre quem está no ministério hoje", () => {
    // 3 escalações da Maria + 1 de alguém que saiu, com 2 pessoas no
    // ministério: a média é 1.5 (a escalação de quem saiu fica fora).
    const relatorio = resumirParticipacoes(
      [MARIA, ANA],
      [
        participacao(MARIA, "2026-08-02T22:00:00Z"),
        participacao(MARIA, "2026-08-09T22:00:00Z"),
        participacao(MARIA, "2026-08-16T22:00:00Z"),
        participacao(JOAO, "2026-08-23T22:00:00Z"),
      ],
    );

    expect(relatorio.mediaPorPessoa).toBe(1.5);
    expect(relatorio.totalEscalacoes).toBe(4);
  });

  it("não quebra com ministério vazio", () => {
    const relatorio = resumirParticipacoes([], []);
    expect(relatorio.linhas).toEqual([]);
    expect(relatorio.mediaPorPessoa).toBe(0);
    expect(relatorio.totalEscalacoes).toBe(0);
  });
});
