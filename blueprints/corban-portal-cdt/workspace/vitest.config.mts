import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Pruebas unitarias e integración. Las de integración usan la base corban_test real
// (tests/setup.ts apunta DATABASE_URL a TEST_DATABASE_URL); por eso los archivos corren en serie.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    exclude: ["blueprints/**", "node_modules/**", ".next/**", "tests/e2e/**"],
    setupFiles: ["./tests/setup.ts"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
