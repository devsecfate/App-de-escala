import { describe, expect, it } from "vitest";
import { intervaloDeDatasLocais, intervaloDoDiaSeguinte, mesDe } from "./datas.js";

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

describe("intervaloDeDatasLocais", () => {
  it("começa à meia-noite local do primeiro dia", () => {
    const intervalo = intervaloDeDatasLocais("2026-08-01", "2026-08-31", SAO_PAULO);
    expect(intervalo.inicio).toBe("2026-08-01T03:00:00.000Z");
  });

  it("inclui o último dia inteiro (fim exclusivo é a meia-noite do dia seguinte)", () => {
    // O culto de 31/08 às 19:00 em São Paulo é 01/09 22:00 em UTC. Filtrar por
    // data crua o jogaria para setembro; aqui ele precisa continuar em agosto.
    const intervalo = intervaloDeDatasLocais("2026-08-01", "2026-08-31", SAO_PAULO);
    expect(intervalo.fim).toBe("2026-09-01T03:00:00.000Z");

    const cultoDeDomingo = new Date("2026-08-31T22:00:00Z");
    expect(cultoDeDomingo >= new Date(intervalo.inicio)).toBe(true);
    expect(cultoDeDomingo < new Date(intervalo.fim)).toBe(true);
  });

  it("aceita um único dia", () => {
    const intervalo = intervaloDeDatasLocais("2026-08-09", "2026-08-09", SAO_PAULO);
    const duracaoHoras =
      (new Date(intervalo.fim).getTime() - new Date(intervalo.inicio).getTime()) / 3_600_000;
    expect(duracaoHoras).toBe(24);
  });

  it("vira o ano", () => {
    const intervalo = intervaloDeDatasLocais("2026-12-01", "2026-12-31", SAO_PAULO);
    expect(intervalo.fim).toBe("2027-01-01T03:00:00.000Z");
  });

  it("recusa data em formato inesperado", () => {
    expect(() => intervaloDeDatasLocais("01/08/2026", "2026-08-31", SAO_PAULO)).toThrow(/AAAA-MM-DD/);
  });
});

describe("mesDe", () => {
  it("devolve o primeiro e o último dia do mês", () => {
    expect(mesDe(new Date("2026-08-09T12:00:00Z"), SAO_PAULO)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });

  it("acerta o último dia de fevereiro em ano bissexto", () => {
    expect(mesDe(new Date("2028-02-10T12:00:00Z"), SAO_PAULO).fim).toBe("2028-02-29");
  });

  it("anda para trás no calendário, virando o ano", () => {
    expect(mesDe(new Date("2026-01-15T12:00:00Z"), SAO_PAULO, -1)).toEqual({
      inicio: "2025-12-01",
      fim: "2025-12-31",
    });
    expect(mesDe(new Date("2026-08-09T12:00:00Z"), SAO_PAULO, -2)).toEqual({
      inicio: "2026-06-01",
      fim: "2026-06-30",
    });
  });

  it("usa o mês local, não o UTC, na virada", () => {
    // 01/09 01:00 UTC ainda é 31/08 22:00 em São Paulo: o mês é agosto.
    expect(mesDe(new Date("2026-09-01T01:00:00Z"), SAO_PAULO)).toEqual({
      inicio: "2026-08-01",
      fim: "2026-08-31",
    });
  });
});
