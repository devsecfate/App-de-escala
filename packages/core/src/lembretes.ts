/**
 * Lembrete de véspera (Fase 3): quem serve amanhã recebe um aviso no celular.
 *
 * A conta de "amanhã" no fuso da igreja mora em `datas.ts`. Aqui fica só o
 * conteúdo da notificação, que o service worker recebe pronto e exibe.
 *
 * IMPORTANTE: assim como `datas.ts`, este arquivo não pode importar nada de
 * outros módulos do core — a Edge Function `enviar-lembretes` o importa por
 * caminho relativo e o Deno não resolve os `.js` que o TypeScript exige aqui.
 */

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
