import { describe, expect, it } from "vitest";
import { gerarLembreteVespera } from "./lembretes.js";

const SAO_PAULO = "America/Sao_Paulo";

describe("gerarLembreteVespera", () => {
  it("diz o ministério no título e o evento, horário e função no corpo", () => {
    const lembrete = gerarLembreteVespera({
      eventoTitulo: "Culto de domingo",
      dataHora: "2026-08-09T22:00:00Z",
      ministerioNome: "Louvor",
      funcaoNome: "Vocal",
      fusoHorario: SAO_PAULO,
    });

    expect(lembrete.titulo).toBe("Amanhã você serve no Louvor");
    expect(lembrete.corpo).toBe("Culto de domingo às 19:00 — Vocal.");
    expect(lembrete.url).toBe("/");
  });
});
