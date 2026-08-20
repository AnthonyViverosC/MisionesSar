import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["pruebas/**/*.test.ts"],
    // Las pruebas de integración hablan con un proyecto real de Supabase:
    // necesitan más margen que una prueba unitaria.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
