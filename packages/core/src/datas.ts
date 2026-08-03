/**
 * Contas de data no fuso da igreja.
 *
 * "Amanhã" (lembrete de véspera) e "o mês de agosto" (relatório) não são
 * intervalos óbvios: o servidor pensa em UTC e a igreja pensa no fuso dela.
 * Um culto de domingo às 19:00 em São Paulo é segunda-feira 22:00 em UTC —
 * filtrar por data crua jogaria esse culto no mês seguinte.
 *
 * Estas funções são puras para dar para testar a conta sem banco nem rede.
 *
 * IMPORTANTE: este arquivo não pode importar nada de outros módulos do core.
 * A Edge Function `enviar-lembretes` o importa por caminho relativo, e o Deno
 * (sem bundler) não resolve os `.js` que o TypeScript exige aqui.
 */

export interface IntervaloIso {
  /** início do intervalo, inclusivo (ISO UTC) */
  inicio: string;
  /** fim do intervalo, exclusivo (ISO UTC) */
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

function partesDaDataIso(data: string): { ano: number; mes: number; dia: number } {
  const casamento = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!casamento) {
    throw new Error(`Data inválida: "${data}". Use o formato AAAA-MM-DD.`);
  }
  return { ano: Number(casamento[1]), mes: Number(casamento[2]), dia: Number(casamento[3]) };
}

/**
 * Intervalo entre duas datas do calendário local (as duas inclusivas), em ISO
 * UTC: começa à meia-noite de `dataInicio` e termina à meia-noite do dia
 * seguinte a `dataFim`, que é exclusiva. É o formato que os filtros
 * `gte`/`lt` do PostgREST esperam.
 *
 * Datas no formato AAAA-MM-DD, como as que o `<input type="date">` devolve.
 */
export function intervaloDeDatasLocais(
  dataInicio: string,
  dataFim: string,
  fusoHorario: string,
): IntervaloIso {
  const de = partesDaDataIso(dataInicio);
  const ate = partesDaDataIso(dataFim);

  const inicio = meiaNoiteLocalEmUtc(de.ano, de.mes, de.dia, fusoHorario);
  // +1 dia no fim para o último dia entrar inteiro; Date.UTC vira mês e ano.
  const diaSeguinteAoFim = new Date(Date.UTC(ate.ano, ate.mes - 1, ate.dia + 1));
  const fim = meiaNoiteLocalEmUtc(
    diaSeguinteAoFim.getUTCFullYear(),
    diaSeguinteAoFim.getUTCMonth() + 1,
    diaSeguinteAoFim.getUTCDate(),
    fusoHorario,
  );

  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

/**
 * Primeiro e último dia de um mês (AAAA-MM-DD), tomando como referência o mês
 * em que `referencia` cai no fuso da igreja. `deslocamentoMeses` anda no
 * calendário: -1 é o mês passado, -2 o retrasado.
 *
 * São as datas que a tela do relatório coloca nos campos de período.
 */
export function mesDe(
  referencia: Date,
  fusoHorario: string,
  deslocamentoMeses = 0,
): { inicio: string; fim: string } {
  const hoje = partesNoFuso(referencia, fusoHorario);
  // Date.UTC normaliza mês negativo ou acima de 12 virando o ano.
  const alvo = new Date(Date.UTC(hoje.ano, hoje.mes - 1 + deslocamentoMeses, 1));
  const ano = alvo.getUTCFullYear();
  const mes = alvo.getUTCMonth() + 1;
  // Dia 0 do mês seguinte é o último dia deste mês (28, 29, 30 ou 31).
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mesFormatado = String(mes).padStart(2, "0");

  return {
    inicio: `${ano}-${mesFormatado}-01`,
    fim: `${ano}-${mesFormatado}-${String(ultimoDia).padStart(2, "0")}`,
  };
}
