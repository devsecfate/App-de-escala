/**
 * Motor de regras da escala (ver regras/regras.md e planejamento/arquitetura.md).
 * Funções puras: recebem o contexto já carregado do banco e devolvem
 * bloqueios (impedem escalar) e avisos (o líder decide se segue em frente).
 */

import type { Indisponibilidade, RegraMinisterio } from "./types.js";

export type CodigoProblema =
  | "fora_do_ministerio"
  | "indisponivel_na_data"
  | "funcao_ja_preenchida"
  | "conflito_outro_ministerio"
  | "limite_mensal_excedido"
  | "intervalo_minimo_nao_respeitado";

export interface ProblemaValidacao {
  codigo: CodigoProblema;
  mensagem: string;
}

export interface ResultadoValidacao {
  bloqueios: ProblemaValidacao[];
  avisos: ProblemaValidacao[];
}

export interface EscalacaoExistente {
  pessoaId: string;
  ministerioId: string;
  dataEvento: string; // ISO date da escala em que a pessoa já está
}

export interface ContextoValidacaoEscalacao {
  pessoaId: string;
  ministerioId: string;
  funcaoId: string;
  dataEvento: string; // ISO date (YYYY-MM-DD) do evento sendo escalado

  /** false se a pessoa não pertence (ou não está mais ativa) no ministério */
  pessoaPertenceAoMinisterio: boolean;

  /** indisponibilidades já cadastradas pela pessoa */
  indisponibilidades: Indisponibilidade[];

  /** outras pessoas já escaladas nesta função, neste mesmo evento */
  outrasPessoasNaMesmaFuncao: { pessoaId: string }[];

  /** escalações da pessoa em OUTROS ministérios, no mesmo evento */
  escalacoesEmOutrosMinisteriosNoEvento: EscalacaoExistente[];

  /** quantas vezes a pessoa já está escalada neste ministério, no mês do evento */
  escalacoesDaPessoaNoMesNesteMinisterio: number;

  /** data (ISO) da última vez que a pessoa serviu neste ministério, se houver */
  dataUltimaEscalacaoNesteMinisterio: string | null;

  /** regras do ministério; ausente = sem limites configurados */
  regras: RegraMinisterio | null;
}

function diasEntre(dataA: string, dataB: string): number {
  const msPorDia = 1000 * 60 * 60 * 24;
  const a = new Date(dataA).getTime();
  const b = new Date(dataB).getTime();
  return Math.abs(Math.round((b - a) / msPorDia));
}

function mesmoMes(dataA: string, dataB: string): boolean {
  const a = new Date(dataA);
  const b = new Date(dataB);
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export function estaIndisponivel(
  dataEvento: string,
  indisponibilidades: Indisponibilidade[],
): boolean {
  const data = new Date(dataEvento).getTime();
  return indisponibilidades.some((ind) => {
    const inicio = new Date(ind.dataInicio).getTime();
    const fim = ind.dataFim ? new Date(ind.dataFim).getTime() : Infinity;
    return data >= inicio && data <= fim;
  });
}

/**
 * Valida se uma pessoa pode ser escalada numa função de um evento.
 * Bloqueios impedem a ação; avisos são exibidos mas não travam o líder.
 */
export function validarEscalacao(ctx: ContextoValidacaoEscalacao): ResultadoValidacao {
  const bloqueios: ProblemaValidacao[] = [];
  const avisos: ProblemaValidacao[] = [];

  if (!ctx.pessoaPertenceAoMinisterio) {
    bloqueios.push({
      codigo: "fora_do_ministerio",
      mensagem: "Esta pessoa não pertence a este ministério.",
    });
  }

  if (estaIndisponivel(ctx.dataEvento, ctx.indisponibilidades)) {
    bloqueios.push({
      codigo: "indisponivel_na_data",
      mensagem: "Esta pessoa marcou indisponibilidade nesta data.",
    });
  }

  const funcaoOcupadaPorOutraPessoa = ctx.outrasPessoasNaMesmaFuncao.some(
    (p) => p.pessoaId !== ctx.pessoaId,
  );
  if (funcaoOcupadaPorOutraPessoa) {
    bloqueios.push({
      codigo: "funcao_ja_preenchida",
      mensagem: "Já existe outra pessoa escalada nesta função, neste evento.",
    });
  }

  const bloquearConflito = ctx.regras?.bloquearConflitoEvento ?? false;
  if (ctx.escalacoesEmOutrosMinisteriosNoEvento.length > 0) {
    const problema: ProblemaValidacao = {
      codigo: "conflito_outro_ministerio",
      mensagem: "Esta pessoa já está escalada em outro ministério neste mesmo evento.",
    };
    if (bloquearConflito) {
      bloqueios.push(problema);
    } else {
      avisos.push(problema);
    }
  }

  const maxEscalasMes = ctx.regras?.maxEscalasMes ?? null;
  if (maxEscalasMes !== null && ctx.escalacoesDaPessoaNoMesNesteMinisterio >= maxEscalasMes) {
    avisos.push({
      codigo: "limite_mensal_excedido",
      mensagem: `Esta pessoa já atingiu o limite de ${maxEscalasMes} escala(s) no mês para este ministério.`,
    });
  }

  const intervaloMinDias = ctx.regras?.intervaloMinDias ?? null;
  if (intervaloMinDias !== null && ctx.dataUltimaEscalacaoNesteMinisterio) {
    const intervalo = diasEntre(ctx.dataUltimaEscalacaoNesteMinisterio, ctx.dataEvento);
    if (intervalo < intervaloMinDias) {
      avisos.push({
        codigo: "intervalo_minimo_nao_respeitado",
        mensagem: `O intervalo mínimo de ${intervaloMinDias} dia(s) entre escalas não foi respeitado (última escala há ${intervalo} dia(s)).`,
      });
    }
  }

  return { bloqueios, avisos };
}

export interface FuncaoObrigatoria {
  id: string;
  nome: string;
}

/**
 * Retorna as funções obrigatórias do ministério que ainda não têm ninguém
 * escalado na escala informada. Usado como aviso ao publicar a escala.
 */
export function funcoesObrigatoriasFaltando(
  funcoesObrigatorias: FuncaoObrigatoria[],
  funcaoIdsPreenchidas: string[],
): FuncaoObrigatoria[] {
  const preenchidas = new Set(funcaoIdsPreenchidas);
  return funcoesObrigatorias.filter((f) => !preenchidas.has(f.id));
}

export { mesmoMes, diasEntre };
