/**
 * Relatório de participação (Fase 5): quantas vezes cada pessoa serviu no
 * período. Serve para o líder enxergar desequilíbrio — quem está carregando o
 * ministério sozinho e quem não é escalado há meses.
 *
 * A agregação é pura para poder ser testada sem banco; quem busca os dados é
 * `api/relatorio.ts`.
 */

import type { StatusConfirmacao } from "./types.js";

/** Uma escalação da pessoa dentro do período consultado. */
export interface ParticipacaoBruta {
  perfilId: string;
  nome: string;
  /** ISO 8601 do evento */
  dataHora: string;
  funcaoNome: string;
  confirmacao: StatusConfirmacao;
}

export interface PessoaDoMinisterio {
  perfilId: string;
  nome: string;
}

export interface LinhaRelatorio {
  perfilId: string;
  nome: string;
  vezes: number;
  confirmadas: number;
  recusadas: number;
  pendentes: number;
  /** ISO do evento mais recente em que serviu no período, ou null */
  ultimaVez: string | null;
  /** funções em que serviu no período, sem repetir */
  funcoes: string[];
  /** false = serviu no período mas saiu do ministério depois */
  aindaNoMinisterio: boolean;
}

export interface RelatorioParticipacao {
  linhas: LinhaRelatorio[];
  totalEscalacoes: number;
  pessoasQueServiram: number;
  /** gente do ministério que não foi escalada nenhuma vez no período */
  pessoasSemServir: number;
  /** escalações por pessoa do ministério — o número que denuncia desequilíbrio */
  mediaPorPessoa: number;
}

function linhaVazia(pessoa: PessoaDoMinisterio, aindaNoMinisterio: boolean): LinhaRelatorio {
  return {
    perfilId: pessoa.perfilId,
    nome: pessoa.nome,
    vezes: 0,
    confirmadas: 0,
    recusadas: 0,
    pendentes: 0,
    ultimaVez: null,
    funcoes: [],
    aindaNoMinisterio,
  };
}

/**
 * Junta as escalações do período com a lista de gente do ministério.
 *
 * Quem não serviu nenhuma vez entra com zero (é metade da utilidade do
 * relatório), e quem serviu mas já saiu do ministério também aparece, marcado
 * como `aindaNoMinisterio: false` — senão a soma das linhas não bateria com o
 * total de escalações.
 */
export function resumirParticipacoes(
  pessoas: readonly PessoaDoMinisterio[],
  participacoes: readonly ParticipacaoBruta[],
): RelatorioParticipacao {
  const porPessoa = new Map<string, LinhaRelatorio>();
  const funcoesPorPessoa = new Map<string, Set<string>>();

  for (const pessoa of pessoas) {
    porPessoa.set(pessoa.perfilId, linhaVazia(pessoa, true));
    funcoesPorPessoa.set(pessoa.perfilId, new Set());
  }

  for (const participacao of participacoes) {
    let linha = porPessoa.get(participacao.perfilId);
    if (!linha) {
      linha = linhaVazia({ perfilId: participacao.perfilId, nome: participacao.nome }, false);
      porPessoa.set(participacao.perfilId, linha);
      funcoesPorPessoa.set(participacao.perfilId, new Set());
    }

    linha.vezes += 1;
    if (participacao.confirmacao === "confirmado") linha.confirmadas += 1;
    else if (participacao.confirmacao === "recusado") linha.recusadas += 1;
    else linha.pendentes += 1;

    if (!linha.ultimaVez || participacao.dataHora > linha.ultimaVez) {
      linha.ultimaVez = participacao.dataHora;
    }
    if (participacao.funcaoNome) {
      funcoesPorPessoa.get(participacao.perfilId)!.add(participacao.funcaoNome);
    }
  }

  const linhas = [...porPessoa.values()].map((linha) => ({
    ...linha,
    funcoes: [...funcoesPorPessoa.get(linha.perfilId)!].sort((a, b) => a.localeCompare(b, "pt-BR")),
  }));

  // Mais escalada primeiro; empate resolve pelo nome para a ordem não dançar
  // entre dois carregamentos iguais.
  linhas.sort((a, b) => b.vezes - a.vezes || a.nome.localeCompare(b.nome, "pt-BR"));

  // A média olha só para quem está no ministério hoje (nos dois lados da
  // divisão): a pergunta do líder é como dividir a próxima escala, não uma
  // estatística do passado.
  const escalacoesDeQuemFicou = linhas
    .filter((linha) => linha.aindaNoMinisterio)
    .reduce((soma, linha) => soma + linha.vezes, 0);

  return {
    linhas,
    totalEscalacoes: participacoes.length,
    pessoasQueServiram: linhas.filter((linha) => linha.vezes > 0).length,
    pessoasSemServir: linhas.filter((linha) => linha.vezes === 0).length,
    mediaPorPessoa:
      pessoas.length === 0 ? 0 : Math.round((escalacoesDeQuemFicou / pessoas.length) * 10) / 10,
  };
}
