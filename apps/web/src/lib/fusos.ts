/**
 * Fusos do Brasil, num lugar só.
 *
 * O fuso da igreja não é enfeite de cadastro: é ele que decide o que é "amanhã"
 * para o lembrete de véspera e o que é "este mês" para o relatório de
 * participação. Escolher errado no onboarding torcia os dois — e até a Etapa 6
 * não havia tela nenhuma para corrigir.
 */

export const FUSOS = [
  { valor: "America/Sao_Paulo", rotulo: "Brasília, São Paulo, Sul e Sudeste (GMT-3)" },
  { valor: "America/Bahia", rotulo: "Salvador e Bahia (GMT-3)" },
  { valor: "America/Fortaleza", rotulo: "Fortaleza, Recife e Nordeste (GMT-3)" },
  { valor: "America/Belem", rotulo: "Belém e Pará (GMT-3)" },
  { valor: "America/Campo_Grande", rotulo: "Campo Grande e Mato Grosso do Sul (GMT-4)" },
  { valor: "America/Cuiaba", rotulo: "Cuiabá e Mato Grosso (GMT-4)" },
  { valor: "America/Manaus", rotulo: "Manaus e Amazonas (GMT-4)" },
  { valor: "America/Porto_Velho", rotulo: "Porto Velho e Rondônia (GMT-4)" },
  { valor: "America/Boa_Vista", rotulo: "Boa Vista e Roraima (GMT-4)" },
  { valor: "America/Rio_Branco", rotulo: "Rio Branco e Acre (GMT-5)" },
  { valor: "America/Noronha", rotulo: "Fernando de Noronha (GMT-2)" },
];

/** O fuso do aparelho, quando é um dos nossos; senão, Brasília. */
export function fusoSugerido(): string {
  try {
    const doAparelho = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return FUSOS.some((fuso) => fuso.valor === doAparelho) ? doAparelho : "America/Sao_Paulo";
  } catch {
    return "America/Sao_Paulo";
  }
}
