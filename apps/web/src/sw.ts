/// <reference lib="webworker" />

/**
 * Service worker do PWA.
 *
 * Faz três coisas:
 *  - serve o app a partir do cache, inclusive nas rotas internas (Fase 5);
 *  - guarda as leituras do Supabase para a escala abrir sem internet (Fase 5);
 *  - exibe as notificações push do lembrete de véspera (Fase 3), que já chegam
 *    prontas da Edge Function `enviar-lembretes` (ver `gerarLembreteVespera`).
 */

import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { NetworkFirst } from "workbox-strategies";
import { CACHE_DE_DADOS } from "./lib/offline";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// registerType "autoUpdate": com injectManifest é o próprio SW que precisa
// assumir o controle assim que instala.
self.skipWaiting();
clientsClaim();

// O app é uma SPA: /eventos e /ministerios/:id não existem como arquivo no
// servidor. Sem esta rota, abrir o app offline direto numa dessas URLs (o
// atalho na tela inicial pode apontar para qualquer uma) daria erro de rede.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

/**
 * Leitura offline: as respostas do PostgREST ficam guardadas e voltam quando a
 * rede falha ou demora demais.
 *
 * NetworkFirst, e não CacheFirst, porque escala desatualizada é pior do que
 * escala que demora: com internet a pessoa sempre vê o dado de agora, e o
 * cache só entra quando não há alternativa.
 *
 * A rota é reconhecida pelo caminho `/rest/v1/` em vez da URL do Supabase para
 * o service worker não precisar de variável de ambiente. `/auth/v1/` fica de
 * fora de propósito: token não se guarda em cache.
 */
registerRoute(
  ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/rest/v1/"),
  new NetworkFirst({
    cacheName: CACHE_DE_DADOS,
    // Rede de igreja costuma ser ruim: depois de 5s vale mais entregar o que
    // está salvo do que deixar a tela girando.
    networkTimeoutSeconds: 5,
    // O PostgREST varia a resposta por cabeçalho (Accept, Prefer); sem isto o
    // match no cache falharia justamente quando é mais necessário.
    matchOptions: { ignoreVary: true },
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

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
