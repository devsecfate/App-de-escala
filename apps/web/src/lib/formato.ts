/**
 * Formatação de data/hora para as telas.
 *
 * Existia uma cópia em Home.tsx, outra em Eventos.tsx e outra em
 * MontarEscala.tsx, divergindo no `weekday` — a mesma escala aparecia como
 * "domingo" numa tela e "dom." na outra. Aqui é uma só, com variantes
 * nomeadas em vez de opções soltas.
 *
 * O fuso é opcional e vem da igreja (`Igreja.fusoHorario`). Sem ele o
 * navegador usa o fuso do aparelho, que é o certo para quem está na cidade da
 * igreja e o errado para quem está viajando — por isso as telas que já têm a
 * igreja em mãos devem passar o fuso.
 */

/** "domingo, 03/08 às 19:00" — usada onde a data é o assunto do cartão. */
export function formatarDataHora(iso: string, fusoHorario?: string): string {
  if (!iso) return "";
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
  return `${maiuscula(dia)} às ${hora}`;
}

/** "dom., 03/08 · 19:00" — usada em lista, onde o espaço é curto. */
export function formatarDataHoraCurta(iso: string, fusoHorario?: string): string {
  if (!iso) return "";
  const data = new Date(iso);
  const dia = data.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: fusoHorario,
  });
  const hora = data.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fusoHorario,
  });
  return `${maiuscula(dia)} · ${hora}`;
}

/** "03/08/2026" */
export function formatarData(iso: string, fusoHorario?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: fusoHorario });
}

/** "19:00" */
export function formatarHora(iso: string, fusoHorario?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: fusoHorario,
  });
}

/**
 * "hoje", "amanhã", "em 3 dias", "há 2 dias". Serve o cartão da próxima
 * escala, onde saber que é *hoje* importa mais que saber que é dia 03.
 */
export function distanciaEmDias(iso: string, agora = new Date()): string {
  if (!iso) return "";
  const umDia = 24 * 60 * 60 * 1000;
  const inicio = (data: Date) => Date.UTC(data.getFullYear(), data.getMonth(), data.getDate());
  const dias = Math.round((inicio(new Date(iso)) - inicio(agora)) / umDia);

  if (dias === 0) return "hoje";
  if (dias === 1) return "amanhã";
  if (dias === -1) return "ontem";
  return dias > 0 ? `em ${dias} dias` : `há ${Math.abs(dias)} dias`;
}

function maiuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
