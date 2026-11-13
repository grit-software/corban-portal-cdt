import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contenedor, CI y lista de lanzamiento (E3-T6): se comprueba el contenido de los archivos, no su
// ejecución. La construcción de la imagen y el smoke de Docker se verifican aparte.

const raiz = path.resolve(".");
const leer = (ruta: string) => readFileSync(path.join(raiz, ruta), "utf8");

describe("CI (.github/workflows/ci.yml)", () => {
  const ci = leer(".github/workflows/ci.yml");

  it("ejecuta el gate completo contra un Postgres 17 de servicio", () => {
    for (const comando of [
      "pnpm install --frozen-lockfile",
      "pnpm exec biome ci .",
      "pnpm typecheck",
      "pnpm db:test:prepare",
      "pnpm test",
      "pnpm build",
      "pnpm e2e",
    ]) {
      expect(ci, comando).toContain(comando);
    }
    expect(ci).toContain("postgres:17-alpine");
  });
});

describe(".dockerignore", () => {
  const lineas = new Set(
    leer(".dockerignore")
      .split(/\r?\n/)
      .map((l) => l.trim()),
  );

  it("excluye secretos, datos locales, blueprints y artefactos de build", () => {
    for (const exclusion of ["blueprints", ".env", ".data", "node_modules", ".next"]) {
      expect(lineas.has(exclusion), exclusion).toBe(true);
    }
  });
});

describe("Dockerfile", () => {
  const dockerfile = leer("Dockerfile");

  it("usa la imagen base fijada y un usuario no root", () => {
    expect(dockerfile).toContain("node:24.22.2-bookworm-slim");
    expect(dockerfile).toContain("USER nextjs");
  });
});

describe("docs/lanzamiento.md", () => {
  const guia = leer("docs/lanzamiento.md");

  it("incluye el aprovisionamiento de Postgres y el paso de migración de release", () => {
    expect(guia).toContain("az postgres flexible-server create");
    expect(guia).toContain("pnpm db:migrate");
  });
});
