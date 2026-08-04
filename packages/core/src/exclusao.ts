/**
 * A frase que o app diz antes de apagar alguma coisa.
 *
 * A regra fechada com o usuário: o que nunca foi usado some de vez; o que já
 * tem histórico é arquivado, some das listas e continua contando certo no
 * relatório. A confirmação precisa dizer QUAL DOS DOIS vai acontecer — "Tem
 * certeza?" não informa nada e treina a pessoa a clicar em "Sim" sem ler.
 *
 * Fica num módulo só porque a mesma decisão aparece em ministério, evento,
 * função e música, e três redações diferentes para a mesma regra confundiriam
 * mais do que ajudariam.
 */

export interface DecisaoDeExclusao {
  titulo: string;
  descricao: string;
  rotuloConfirmar: string;
  /** true = arquivar (tem histórico); false = excluir de vez. */
  arquivar: boolean;
}

export function decidirExclusao(params: {
  /** "o ministério", "o evento", "a função"… já com artigo. */
  oQue: string;
  nome: string;
  /** Quantas escalações (ou usos) dependem do item. */
  historico: number;
  /** Como chamar o que o histórico conta. Ex: "escalas", "cronogramas". */
  unidadeHistorico?: string;
  /**
   * false quando a policy de DELETE não alcança quem está na tela — em
   * `eventos`, por exemplo, qualquer líder arquiva mas só o admin exclui.
   * Oferecer "excluir de vez" nesse caso só produziria um erro de permissão
   * depois do clique.
   */
  podeExcluirDeVez?: boolean;
}): DecisaoDeExclusao {
  const { oQue, nome, historico, unidadeHistorico = "escalas", podeExcluirDeVez = true } = params;

  if (historico === 0 && !podeExcluirDeVez) {
    return {
      titulo: `Arquivar “${nome}”?`,
      descricao:
        `${maiuscula(oQue)} some das listas do dia a dia e pode voltar quando você quiser. ` +
        "Excluir de vez é coisa que só o administrador da igreja faz.",
      rotuloConfirmar: "Arquivar",
      arquivar: true,
    };
  }

  if (historico === 0) {
    return {
      titulo: `Excluir “${nome}”?`,
      descricao:
        `${maiuscula(oQue)} nunca foi usado, então some de vez — nada no histórico depende dele. ` +
        "Esta ação não tem volta.",
      rotuloConfirmar: "Excluir de vez",
      arquivar: false,
    };
  }

  const plural = historico === 1 ? unidadeHistoricoSingular(unidadeHistorico) : unidadeHistorico;

  return {
    titulo: `Arquivar “${nome}”?`,
    descricao:
      `“${nome}” já aparece em ${historico} ${plural}. Por isso vou arquivar em vez de excluir: ` +
      "some das listas do dia a dia, mas o histórico e o relatório continuam certos. " +
      "Dá para desarquivar depois.",
    rotuloConfirmar: "Arquivar",
    arquivar: true,
  };
}

function unidadeHistoricoSingular(unidade: string): string {
  return unidade.endsWith("s") ? unidade.slice(0, -1) : unidade;
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
