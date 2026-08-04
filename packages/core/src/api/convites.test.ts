import { describe, expect, it } from "vitest";
import {
  conviteAtivo,
  formatarCodigoConvite,
  normalizarCodigoConvite,
  textoConviteWhatsApp,
} from "./convites.js";
import type { Convite } from "../types.js";

function convite(parcial: Partial<Convite> = {}): Convite {
  return {
    id: "c1",
    igrejaId: "i1",
    ministerioId: "m1",
    codigo: "ABCD2345",
    nomeSugerido: null,
    papel: "membro",
    usosMax: 1,
    usos: 0,
    expiraEm: "2026-08-10T12:00:00.000Z",
    canceladoEm: null,
    criadoPor: "p1",
    criadoEm: "2026-08-03T12:00:00.000Z",
    ...parcial,
  };
}

const AGORA = new Date("2026-08-04T12:00:00.000Z");

describe("normalizarCodigoConvite", () => {
  it("aceita o código como a pessoa digita: minúscula, hífen e espaço", () => {
    expect(normalizarCodigoConvite("abcd-2345")).toBe("ABCD2345");
    expect(normalizarCodigoConvite(" ABCD 2345 ")).toBe("ABCD2345");
    expect(normalizarCodigoConvite("AbCd–2345".replace("–", "-"))).toBe("ABCD2345");
  });

  it("não inventa nada quando vem vazio", () => {
    expect(normalizarCodigoConvite("")).toBe("");
  });
});

describe("formatarCodigoConvite", () => {
  it("parte em dois blocos de quatro, que é como se lê em voz alta", () => {
    expect(formatarCodigoConvite("ABCD2345")).toBe("ABCD-2345");
    expect(formatarCodigoConvite("abcd2345")).toBe("ABCD-2345");
  });

  it("deixa como está o que ainda não tem oito caracteres (a pessoa digitando)", () => {
    expect(formatarCodigoConvite("ABC")).toBe("ABC");
  });
});

describe("conviteAtivo", () => {
  it("vale enquanto não venceu, não foi cancelado e ainda tem uso", () => {
    expect(conviteAtivo(convite(), AGORA)).toBe(true);
  });

  it("não vale depois de vencido", () => {
    expect(conviteAtivo(convite({ expiraEm: "2026-08-01T12:00:00.000Z" }), AGORA)).toBe(false);
  });

  it("não vale depois de cancelado", () => {
    expect(conviteAtivo(convite({ canceladoEm: "2026-08-03T13:00:00.000Z" }), AGORA)).toBe(false);
  });

  it("não vale depois de esgotar os usos", () => {
    expect(conviteAtivo(convite({ usosMax: 2, usos: 2 }), AGORA)).toBe(false);
    expect(conviteAtivo(convite({ usosMax: 2, usos: 1 }), AGORA)).toBe(true);
  });
});

describe("textoConviteWhatsApp", () => {
  it("traz o código escrito E o link — link some quando o app encurta a mensagem", () => {
    const texto = textoConviteWhatsApp(convite(), "https://escala.exemplo/", {
      igrejaNome: "Igreja Central",
      ministerioNome: "Louvor",
    });

    expect(texto).toContain("*ABCD-2345*");
    expect(texto).toContain("https://escala.exemplo/cadastrar?convite=ABCD2345");
    expect(texto).toContain("Louvor · Igreja Central");
  });

  it("não deixa barra dobrada no link quando a URL do app termina em barra", () => {
    const texto = textoConviteWhatsApp(convite(), "https://escala.exemplo//");
    expect(texto).not.toContain("exemplo//cadastrar");
  });

  it("funciona sem saber a igreja nem o ministério", () => {
    const texto = textoConviteWhatsApp(convite(), "https://escala.exemplo");
    expect(texto).toContain("*Convite para o App de Escala*");
  });
});
