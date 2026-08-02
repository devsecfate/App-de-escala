/**
 * Lembrete de véspera (Fase 3): quem serve amanhã recebe um aviso no celular.
 *
 * A parte delicada é "amanhã" — o job roda em UTC, mas a igreja pensa no fuso
 * dela. Estas funções são puras justamente para dar para testar essa conta sem
 * banco nem rede; a Edge Function `enviar-lembretes` só as consome.
 */

export interface IntervaloIso {
  /** início do dia, inclusivo (ISO UTC) */
  inicio: string;
  /** início do dia seguinte, exclusivo (ISO UTC) */
  fim: string;
}

interface PartesData {
  ano: number;
  mes: number; // 1-12
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

function partesNoFuso(instante: Date, fusoHorario: string): PartesData {
  const formatador = new Intl.DateTimeFormat("en-US", {
    timeZone: fusoHorario,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const partes: Record<string, string> = {};
  for (const parte of formatador.formatToParts(instante)) {
    if (parte.type !== "literal") partes[parte.type] = parte.value;
  }

  return {
    ano: Number(partes.year),
    mes: Number(partes.month),
    // "24" aparece em algumas implementações para meia-noite com hour12:false.
    dia: Number(partes.day),
    hora: Number(partes.hour) % 24,
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
  };
}

/** Quanto o fuso está adiantado/atrasado em relação ao UTC, neste instante. */
function deslocamentoMs(instante: Date, fusoHorario: string): number {
  const p = partesNoFuso(instante, fusoHorario);
  const comoSeFosseUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  // Zera os milissegundos do instante original: formatToParts não os devolve.
  const instanteSemMs = Math.floor(instante.getTime() / 1000) * 1000;
  return comoSeFosseUtc - instanteSemMs;
}

/**
 * Instante UTC correspondente à meia-noite local da data informada.
 * Aplica o deslocamento duas vezes porque o próprio deslocamento pode mudar
 * entre o palpite e a data final (horário de verão).
 */
function meiaNoiteLocalEmUtc(ano: number, mes: number, dia: number, fusoHorario: string): Date {
  const palpite = Date.UTC(ano, mes - 1, dia, 0, 0, 0);
  const primeiro = palpite - deslocamentoMs(new Date(palpite), fusoHorario);
  const segundo = palpite - deslocamentoMs(new Date(primeiro), fusoHorario);
  return new Date(segundo);
}

/**
 * Intervalo do dia seguinte a `agora`, no fuso da igreja, devolvido em ISO UTC
 * para ir direto no filtro `gte`/`lt` da query de eventos.
 */
export function intervaloDoDiaSeguinte(agora: Date, fusoHorario: string): IntervaloIso {
  const hoje = partesNoFuso(agora, fusoHorario);

  // Date.UTC normaliza a virada de mês e de ano (31/12 + 1 = 01/01).
  const amanha = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 1));
  const depoisDeAmanha = new Date(Date.UTC(hoje.ano, hoje.mes - 1, hoje.dia + 2));

  const inicio = meiaNoiteLocalEmUtc(
    amanha.getUTCFullYear(),
    amanha.getUTCMonth() + 1,
    amanha.getUTCDate(),
    fusoHorario,
  );
  const fim = meiaNoiteLocalEmUtc(
    depoisDeAmanha.getUTCFullYear(),
    depoisDeAmanha.getUTCMonth() + 1,
    depoisDeAmanha.getUTCDate(),
    fusoHorario,
  );

  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export interface DadosLembrete {
  eventoTitulo: string;
  /** ISO 8601 do evento */
  dataHora: string;
  ministerioNome: string;
  funcaoNome: string;
  fusoHorario?: string;
}

/** Conteúdo que o service worker recebe e exibe como notificação. */
export interface ConteudoNotificacao {
  titulo: string;
  corpo: string;
  url: string;
}

export function gerarLembreteVespera(dados: DadosLembrete): ConteudoNotificacao {
  const hora = new Date(dados.dataHora).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: dados.fusoHorario,
  });

  return {
    titulo: `Amanhã você serve no ${dados.ministerioNome}`,
    corpo: `${dados.eventoTitulo} às ${hora} — ${dados.funcaoNome}.`,
    url: "/",
  };
}
