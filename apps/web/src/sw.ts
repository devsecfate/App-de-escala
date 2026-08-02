/// <reference lib="webworker" />

/**
 * Service worker do PWA (Fase 3).
 *
 * Além do cache offline que o Workbox injeta, trata as notificações push do
 * lembrete de véspera. O conteúdo vem pronto da Edge Function `enviar-lembretes`
 * (ver `gerarLembreteVespera` em packages/core) — aqui só exibimos.
 */

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// registerType "autoUpdate": com injectManifest é o próprio SW que precisa
// assumir o controle assim que instala.
self.skipWaiting();
clientsClaim();

interface ConteudoNotificacao {
  titulo: string;
  corpo: string;
  url: string;
}

const PADRAO: ConteudoNotificacao = {
  titulo: "App de Escala",
  corpo: "Você tem um aviso da escala.",
  url: "/",
};

function lerConteudo(evento: PushEvent): ConteudoNotificacao {
  if (!evento.data) return PADRAO;
  try {
    const dados = evento.data.json() as Partial<ConteudoNotificacao>;
    return {
      titulo: dados.titulo ?? PADRAO.titulo,
      corpo: dados.corpo ?? PADRAO.corpo,
      url: dados.url ?? PADRAO.url,
    };
  } catch {
    // Payload que não é JSON: melhor mostrar o texto cru do que engolir o aviso.
    return { ...PADRAO, corpo: evento.data.text() || PADRAO.corpo };
  }
}

self.addEventListener("push", (evento: PushEvent) => {
  const conteudo = lerConteudo(evento);
  evento.waitUntil(
    self.registration.showNotification(conteudo.titulo, {
      body: conteudo.corpo,
      icon: "/pwa-icon.svg",
      badge: "/pwa-icon.svg",
      data: { url: conteudo.url },
      // Um lembrete por escalação; a tag evita empilhar o mesmo aviso.
      tag: conteudo.url,
    }),
  );
});

self.addEventListener("notificationclick", (evento: NotificationEvent) => {
  evento.notification.close();
  const destino = (evento.notification.data as { url?: string } | null)?.url ?? "/";

  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Se o app já está aberto, foca a aba em vez de abrir outra.
      for (const janela of janelas) {
        if ("focus" in janela) {
          await janela.focus();
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});
