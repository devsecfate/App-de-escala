import { describe, expect, it } from "vitest";
import { gerarTextoEscala, linkWhatsApp, type DadosEscalaTexto } from "./texto-escala.js";

// 2026-08-09T22:00:00Z = domingo, 09/08 às 19:00 em America/Sao_Paulo (UTC-3).
function dadosBase(overrides: Partial<DadosEscalaTexto> = {}): DadosEscalaTexto {
  return {
    ministerioNome: "Louvor",
    eventoTitulo: "Culto de domingo",
    dataHora: "2026-08-09T22:00:00Z",
    fusoHorario: "America/Sao_Paulo",
    itens: [
      { funcaoNome: "Vocal", pessoaNome: "Maria Silva" },
      { funcaoNome: "Violão", pessoaNome: "João Pereira" },
    ],
    ...overrides,
  };
}

describe("gerarTextoEscala", () => {
  it("monta cabeçalho com ministério, evento e data no fuso da igreja", () => {
    const texto = gerarTextoEscala(dadosBase());
    expect(texto).toContain("*Louvor · Culto de domingo*");
    expect(texto).toContain("Domingo");
    expect(texto).toContain("19:00");
  });

  it("lista cada função com quem está escalado", () => {
    const texto = gerarTextoEscala(dadosBase());
    expect(texto).toContain("Vocal: Maria Silva");
    expect(texto).toContain("Violão: João Pereira");
  });

  it("marca como 'a definir' a função sem ninguém escalado", () => {
    const texto = gerarTextoEscala(
      dadosBase({ itens: [{ funcaoNome: "Teclado", pessoaNome: null }] }),
    );
    expect(texto).toContain("Teclado: _a definir_");
  });

  it("inclui as observações do evento quando existirem", () => {
    const texto = gerarTextoEscala(dadosBase({ observacoes: "Ensaio 18h, trazer instrumento." }));
    expect(texto).toContain("Ensaio 18h, trazer instrumento.");
  });

  it("ignora observações vazias ou só com espaços", () => {
    const texto = gerarTextoEscala(dadosBase({ observacoes: "   " }));
    expect(texto).not.toMatch(/\n\n\n/);
  });

  it("avisa quando o ministério ainda não tem funções", () => {
    const texto = gerarTextoEscala(dadosBase({ itens: [] }));
    expect(texto).toContain("Nenhuma função cadastrada");
  });

  it("termina pedindo a confirmação no app", () => {
    expect(gerarTextoEscala(dadosBase())).toContain("_Confirme sua presença no app._");
  });
});

describe("linkWhatsApp", () => {
  it("escapa quebras de linha e acentos no parâmetro text", () => {
    const link = linkWhatsApp("Louvor\nViolão: João");
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(link).not.toContain("\n");
    expect(decodeURIComponent(link.replace("https://wa.me/?text=", ""))).toBe("Louvor\nViolão: João");
  });
});
