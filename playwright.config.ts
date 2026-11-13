import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Playwright no lee .env por sí mismo: se carga aquí, una vez, para todas las ejecuciones.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const PUERTO = 3200;
const URL_BASE = `http://127.0.0.1:${PUERTO}`;

// E2E contra `next dev` (no contra la build de producción): /api/test/login responde 404 en
// producción por diseño, y los flujos de staff lo necesitan. La base es corban_test.
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/e2e/preparar.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: "list",
  timeout: 90000,
  use: {
    baseURL: URL_BASE,
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Se borra la caché de `next dev` (.next) antes de arrancar: cada corrida parte de cero.
    command: `node -e "require('node:fs').rmSync('.next',{recursive:true,force:true})" && pnpm dev --port ${PUERTO} --hostname 127.0.0.1`,
    url: `${URL_BASE}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_URL: URL_BASE,
      AUTH_TEST_LOGIN: "1",
      MAIL_DRIVER: "file",
      MAIL_FILE_DIR: ".data/e2e-mail",
      STORAGE_DRIVER: "fs",
      STORAGE_FS_ROOT: ".data/e2e-storage",
    },
  },
});
