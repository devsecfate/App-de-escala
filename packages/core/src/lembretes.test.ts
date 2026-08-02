import { describe, expect, it } from "vitest";
import { gerarLembreteVespera, intervaloDoDiaSeguinte } from "./lembretes.js";

const SAO_PAULO = "America/Sao_Paulo"; // UTC-3, sem horário de verão desde 2019
const NOVA_YORK = "America/New_York"; // com horário de verão, para testar a virada

describe("intervaloDoDiaSeguinte", () => {
  it("cobre o dia seguinte inteiro, em UTC, no fuso da igreja", () => {
    // 09/08 09:00 em São Paulo -> amanhã é 10/08 local = 10/08 03:00 UTC
    const intervalo = intervaloDoDiaSeguinte(new Date("2026-08-09T12:00:00Z"), SAO_PAULO);
    expect(intervalo.inicio).toBe("2026-08-10T03:00:00.000Z");
    expect(intervalo.fim).toBe("2026-08-11T03:00:00.000Z");
  });

  it("usa o dia local, não o dia UTC, quando já virou o dia em UTC", () => {
    // 10/08 02:00 UTC ainda é 09/08 23:00 em São Paulo: amanhã continua sendo 10/08.
    const intervalo = intervaloDoDiaSeguinte(new Date("2026-08-10T02:00:00Z"), SAO_PAULO);
    expect(intervalo.inicio).toBe("2026-08-10T03:00:00.000Z");
  });

  it("vira o mês corretamente", () => {
    const intervalo = intervaloDoDiaSeguinte(new Date("2026-08-31T12:00:00Z"), SAO_PAULO);
    expect(intervalo.inicio).toBe("2026-09-01T03:00:00.000Z");
    expect(intervalo.fim).toBe("2026-09-02T03:00:00.000Z");
  });

  it("vira o ano corretamente", () => {
    const intervalo = intervaloDoDiaSeguinte(new Date("2026-12-31T12:00:00Z"), SAO_PAULO);
    expect(intervalo.inicio).toBe("2027-01-01T03:00:00.000Z");
  });

  it("acompanha a entrada do horário de verão (dia de 23 horas)", () => {
    // Nos EUA o horário de verão de 2026 começa em 08/03. A véspera (07/03)
    // ainda é EST (UTC-5) e o dia seguinte termina já em EDT (UTC-4).
    const intervalo = intervaloDoDiaSeguinte(new Date("2026-03-07T17:00:00Z"), NOVA_YORK);
    expect(intervalo.inicio).toBe("2026-03-08T05:00:00.000Z");
    expect(intervalo.fim).toBe("2026-03-09T04:00:00.000Z");

    const duracaoHoras =
      (new Date(intervalo.fim).getTime() - new Date(intervalo.inicio).getTime()) / 3_600_000;
    expect(duracaoHoras).toBe(23);
  });

  it("devolve um intervalo de 24 horas num dia comum", () => {
    const intervalo = intervaloDoDiaSeguinte(new Date("2026-08-09T12:00:00Z"), SAO_PAULO);
    const duracaoHoras =
      (new Date(intervalo.fim).getTime() - new Date(intervalo.inicio).getTime()) / 3_600_000;
    expect(duracaoHoras).toBe(24);
  });
});

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
