import { defineConfig } from "vitest/config";

/**
 * Suíte de integração: roda contra o Supabase local de verdade
 * (`npx supabase start` na raiz do repo), aplicando as migrations e o seed.
 *
 * Fica separada da suíte normal (`npm test`) de propósito: aquela é pura e
 * roda em qualquer lugar; esta exige Docker no ar.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.integracao.test.ts"],
    // As chamadas passam por HTTP e por várias policies; o padrão de 5s é curto.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Os testes compartilham o mesmo banco: rodar em paralelo embaralharia o estado.
    fileParallelism: false,
  },
});
