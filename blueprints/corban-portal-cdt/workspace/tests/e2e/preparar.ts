import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";

// globalSetup de Playwright: corban_test limpia + semilla demo + staff E2E.
// Se usa desde el paso 8 (primer paso con E2E); necesita las tablas del paso 3.
export default function prepararE2e(): void {
  if (existsSync(".env")) {
    process.loadEnvFile(".env");
  }
  const urlPruebas = process.env.TEST_DATABASE_URL;
  if (!urlPruebas) {
    throw new Error("TEST_DATABASE_URL no está definida (ver .env.example)");
  }
  rmSync(".data/e2e-mail", { recursive: true, force: true });
  rmSync(".data/e2e-storage", { recursive: true, force: true });
  const env = { ...process.env, DATABASE_URL: urlPruebas };
  execFileSync("pnpm", ["db:test:prepare"], { stdio: "inherit", env });
  execFileSync("pnpm", ["db:seed:demo"], { stdio: "inherit", env });
  execFileSync("pnpm", ["exec", "tsx", "scripts/semilla-e2e.ts"], { stdio: "inherit", env });
}
