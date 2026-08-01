import { describe, expect, it } from "vitest";
import {
  estaIndisponivel,
  funcoesObrigatoriasFaltando,
  validarEscalacao,
  type ContextoValidacaoEscalacao,
} from "./regras.js";
import type { Indisponibilidade, RegraMinisterio } from "./types.js";

function contextoBase(overrides: Partial<ContextoValidacaoEscalacao> = {}): ContextoValidacaoEscalacao {
  return {
    pessoaId: "pessoa-1",
    ministerioId: "ministerio-louvor",
    funcaoId: "funcao-vocal",
    dataEvento: "2026-08-09",
    pessoaPertenceAoMinisterio: true,
    indisponibilidades: [],
    outrasPessoasNaMesmaFuncao: [],
    escalacoesEmOutrosMinisteriosNoEvento: [],
    escalacoesDaPessoaNoMesNesteMinisterio: 0,
    dataUltimaEscalacaoNesteMinisterio: null,
    regras: null,
    ...overrides,
  };
}

describe("validarEscalacao — bloqueios", () => {
  it("bloqueia quando a pessoa não pertence ao ministério", () => {
    const resultado = validarEscalacao(contextoBase({ pessoaPertenceAoMinisterio: false }));
    expect(resultado.bloqueios.map((b) => b.codigo)).toContain("fora_do_ministerio");
  });

  it("bloqueia quando a pessoa está indisponível na data do evento", () => {
    const indisponibilidades: Indisponibilidade[] = [
      {
        id: "ind-1",
        perfilId: "pessoa-1",
        dataInicio: "2026-08-05",
        dataFim: "2026-08-15",
        motivo: "viagem",
      },
    ];
    const resultado = validarEscalacao(contextoBase({ indisponibilidades }));
    expect(resultado.bloqueios.map((b) => b.codigo)).toContain("indisponivel_na_data");
  });

  it("não bloqueia por indisponibilidade fora do período", () => {
    const indisponibilidades: Indisponibilidade[] = [
      {
        id: "ind-1",
        perfilId: "pessoa-1",
        dataInicio: "2026-09-01",
        dataFim: "2026-09-10",
        motivo: "viagem",
      },
    ];
    const resultado = validarEscalacao(contextoBase({ indisponibilidades }));
    expect(resultado.bloqueios).toHaveLength(0);
  });

  it("bloqueia quando a função já está preenchida por outra pessoa", () => {
    const resultado = validarEscalacao(
      contextoBase({ outrasPessoasNaMesmaFuncao: [{ pessoaId: "pessoa-2" }] }),
    );
    expect(resultado.bloqueios.map((b) => b.codigo)).toContain("funcao_ja_preenchida");
  });

  it("não bloqueia quando a própria pessoa já está na função (reedição)", () => {
    const resultado = validarEscalacao(
      contextoBase({ outrasPessoasNaMesmaFuncao: [{ pessoaId: "pessoa-1" }] }),
    );
    expect(resultado.bloqueios).toHaveLength(0);
  });
});

describe("validarEscalacao — avisos", () => {
  it("avisa (não bloqueia) sobre conflito com outro ministério no mesmo evento", () => {
    const resultado = validarEscalacao(
      contextoBase({
        escalacoesEmOutrosMinisteriosNoEvento: [
          { pessoaId: "pessoa-1", ministerioId: "ministerio-tecnologia", dataEvento: "2026-08-09" },
        ],
      }),
    );
    expect(resultado.avisos.map((a) => a.codigo)).toContain("conflito_outro_ministerio");
    expect(resultado.bloqueios).toHaveLength(0);
  });

  it("bloqueia o conflito entre ministérios quando o ministério configura bloquear_conflito_evento", () => {
    const regras: RegraMinisterio = {
      id: "regra-1",
      ministerioId: "ministerio-louvor",
      maxEscalasMes: null,
      intervaloMinDias: null,
      bloquearConflitoEvento: true,
    };
    const resultado = validarEscalacao(
      contextoBase({
        regras,
        escalacoesEmOutrosMinisteriosNoEvento: [
          { pessoaId: "pessoa-1", ministerioId: "ministerio-tecnologia", dataEvento: "2026-08-09" },
        ],
      }),
    );
    expect(resultado.bloqueios.map((b) => b.codigo)).toContain("conflito_outro_ministerio");
    expect(resultado.avisos).toHaveLength(0);
  });

  it("avisa quando o limite mensal foi atingido", () => {
    const regras: RegraMinisterio = {
      id: "regra-1",
      ministerioId: "ministerio-louvor",
      maxEscalasMes: 2,
      intervaloMinDias: null,
      bloquearConflitoEvento: false,
    };
    const resultado = validarEscalacao(
      contextoBase({ regras, escalacoesDaPessoaNoMesNesteMinisterio: 2 }),
    );
    expect(resultado.avisos.map((a) => a.codigo)).toContain("limite_mensal_excedido");
  });

  it("não avisa sobre limite mensal quando ainda não foi atingido", () => {
    const regras: RegraMinisterio = {
      id: "regra-1",
      ministerioId: "ministerio-louvor",
      maxEscalasMes: 2,
      intervaloMinDias: null,
      bloquearConflitoEvento: false,
    };
    const resultado = validarEscalacao(
      contextoBase({ regras, escalacoesDaPessoaNoMesNesteMinisterio: 1 }),
    );
    expect(resultado.avisos.map((a) => a.codigo)).not.toContain("limite_mensal_excedido");
  });

  it("avisa quando o intervalo mínimo entre escalas não foi respeitado", () => {
    const regras: RegraMinisterio = {
      id: "regra-1",
      ministerioId: "ministerio-louvor",
      maxEscalasMes: null,
      intervaloMinDias: 14,
      bloquearConflitoEvento: false,
    };
    const resultado = validarEscalacao(
      contextoBase({ regras, dataUltimaEscalacaoNesteMinisterio: "2026-08-02" }),
    );
    expect(resultado.avisos.map((a) => a.codigo)).toContain("intervalo_minimo_nao_respeitado");
  });

  it("não avisa sobre intervalo quando o período já passou do mínimo", () => {
    const regras: RegraMinisterio = {
      id: "regra-1",
      ministerioId: "ministerio-louvor",
      maxEscalasMes: null,
      intervaloMinDias: 14,
      bloquearConflitoEvento: false,
    };
    const resultado = validarEscalacao(
      contextoBase({ regras, dataUltimaEscalacaoNesteMinisterio: "2026-07-01" }),
    );
    expect(resultado.avisos.map((a) => a.codigo)).not.toContain("intervalo_minimo_nao_respeitado");
  });
});

describe("estaIndisponivel", () => {
  it("considera indisponibilidade em aberto (sem data fim)", () => {
    const indisponibilidades: Indisponibilidade[] = [
      { id: "ind-1", perfilId: "pessoa-1", dataInicio: "2026-08-01", dataFim: null, motivo: "afastamento" },
    ];
    expect(estaIndisponivel("2027-01-01", indisponibilidades)).toBe(true);
  });
});

describe("funcoesObrigatoriasFaltando", () => {
  it("retorna só as funções obrigatórias sem ninguém escalado", () => {
    const faltando = funcoesObrigatoriasFaltando(
      [
        { id: "f-vocal", nome: "Vocal" },
        { id: "f-som", nome: "Som" },
      ],
      ["f-vocal"],
    );
    expect(faltando).toEqual([{ id: "f-som", nome: "Som" }]);
  });
});
