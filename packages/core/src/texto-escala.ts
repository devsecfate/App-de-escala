/**
 * Geração do texto pronto da escala para compartilhar (ver planejamento/arquitetura.md,
 * seção WhatsApp — Fase 3). Funções puras, sem DOM: o app nativo reaproveita igual.
 *
 * A formatação usa a marcação do WhatsApp: *negrito* e _itálico_.
 */

export interface ItemEscalaTexto {
  funcaoNome: string;
  /** null quando ninguém foi escalado nesta função */
  pessoaNome: string | null;
}

/** Uma música do cronograma do culto (Fase 4), já na ordem. */
export interface ItemCronogramaTexto {
  titulo: string;
  /** tom escolhido para este culto; caindo para o tom padrão da música */
  tom?: string | null;
  /** momento do culto (ex: Abertura, Ceia) */
  momento?: string | null;
}

export interface DadosEscalaTexto {
  ministerioNome: string;
  eventoTitulo: string;
  /** ISO 8601 do evento */
  dataHora: string;
  itens: ItemEscalaTexto[];
  /** cronograma de louvor; vazio ou ausente omite a seção inteira */
  cronograma?: ItemCronogramaTexto[];
  observacoes?: string | null;
  /** IANA (ex: America/Sao_Paulo); ausente = fuso do dispositivo */
  fusoHorario?: string;
}

const SEM_NINGUEM = "_a definir_";

function formatarDataHoraParaTexto(iso: string, fusoHorario?: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: fusoHorario,
  });
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fusoHorario,
  });
  const formatado = `${dia} às ${hora}`;
  return formatado.charAt(0).toUpperCase() + formatado.slice(1);
}

/**
 * Monta a mensagem da escala pronta para colar no grupo.
 * Funções sem ninguém escalado aparecem como "a definir" em vez de sumirem —
 * é justamente isso que o líder precisa que o grupo veja.
 */
export function gerarTextoEscala(dados: DadosEscalaTexto): string {
  const linhas: string[] = [
    `*${dados.ministerioNome} · ${dados.eventoTitulo}*`,
    formatarDataHoraParaTexto(dados.dataHora, dados.fusoHorario),
    "",
  ];

  if (dados.itens.length === 0) {
    linhas.push("_Nenhuma função cadastrada neste ministério._");
  } else {
    for (const item of dados.itens) {
      linhas.push(`${item.funcaoNome}: ${item.pessoaNome ?? SEM_NINGUEM}`);
    }
  }

  if (dados.cronograma && dados.cronograma.length > 0) {
    linhas.push("", "*Repertório*");
    dados.cronograma.forEach((musica, indice) => {
      const detalhes = [musica.tom?.trim(), musica.momento?.trim()].filter(Boolean);
      const sufixo = detalhes.length > 0 ? ` (${detalhes.join(" · ")})` : "";
      linhas.push(`${indice + 1}. ${musica.titulo}${sufixo}`);
    });
  }

  if (dados.observacoes?.trim()) {
    linhas.push("", dados.observacoes.trim());
  }

  linhas.push("", "_Confirme sua presença no app._");

  return linhas.join("\n");
}

/** Link que abre o WhatsApp com a mensagem pronta, para o líder escolher o grupo. */
export function linkWhatsApp(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
