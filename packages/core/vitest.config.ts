import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integração exige Supabase local no ar; roda por `npm run test:integracao`.
    exclude: ["**/node_modules/**", "src/**/*.integracao.test.ts"],
  },
});
