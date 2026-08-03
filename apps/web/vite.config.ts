import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath } from "node:url";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");

  // Sem as variáveis do Supabase, o `throw` no topo de src/lib/supabase.ts vira
  // incondicional depois do inline do Vite, e o Rollup descarta o app inteiro
  // como código inalcançável: o build "passa" e publica um bundle vazio.
  // Falhar aqui é o único jeito de isso não chegar na Vercel silenciosamente.
  if (command === "build" && (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error(
      "Build cancelado: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY " +
        "(copie apps/web/.env.example para apps/web/.env, ou configure as variáveis no deploy).",
    );
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // injectManifest (em vez do generateSW) porque o service worker precisa
        // de código nosso: os handlers de push do lembrete de véspera (src/sw.ts).
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        registerType: "autoUpdate",
        includeAssets: ["pwa-icon.svg", "apple-touch-icon.png"],
        manifest: {
          id: "/",
          name: "App de Escala",
          short_name: "Escala",
          description: "Organize a escala de pessoas que servem na igreja, por ministério.",
          lang: "pt-BR",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          start_url: "/",
          scope: "/",
          // Os PNGs saem de `node scripts/gerar-icones.mjs`. O 192 e o 512 são
          // o mínimo que o Chrome pede para oferecer a instalação; o maskable
          // é o que evita o Android cortar o desenho ao aplicar a máscara dele.
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "pwa-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@escala-app/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
      },
    },
  };
});
