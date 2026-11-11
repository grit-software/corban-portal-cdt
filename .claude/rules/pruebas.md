---
description: Convenciones de pruebas unitarias, de integración y E2E
paths:
  - "tests/**"
---

# Pruebas

- Unitarias e integración con Vitest (`tests/unit/**`, `tests/integration/**`); E2E con Playwright
  (`tests/e2e/**/*.spec.ts`). `tests/setup.ts` apunta `DATABASE_URL` a `TEST_DATABASE_URL`: ninguna
  prueba toca la base de desarrollo.
- Antes de correr integración: `docker compose up -d --wait postgres` y `pnpm db:test:prepare`.
- Nunca truncar ni borrar tablas; nunca depender del orden. Cada prueba crea sus filas con claves
  únicas (`crypto.randomUUID()`, `crearCondicion()` con plazo único) usando `tests/helpers/fabricas.ts`.
- Las rutas se prueban llamando el handler exportado con un `Request` real (cabecera `origin` =
  `getEnv().BETTER_AUTH_URL` en mutaciones; cookie de `iniciarSesionPorOtp()`).
- OTP: se leen del último JSON del directorio del driver `file` (`.data/test-mail` en Vitest,
  `.data/e2e-mail` en E2E) con `/\b(\d{6})\b/` sobre `texto`.
- Binarios de prueba (PNG, .xlsx) se generan dentro de la prueba; no se commitean binarios.
- Errores de Postgres: código en `(error.cause ?? error).code`.
- Prohibido `.skip` y `.only` en el repositorio (lo verifica el paso 19).
- Snapshots golden (`tests/unit/__snapshots__/pdf-*.json`): solo con la skill `regenerar-golden`.
- Aserciones sobre propiedades, no sobre conteos del repositorio ("cada tabla exportada existe",
  "0 fallidas"); los conteos solo cuando son invariantes del dominio sembrados en la propia prueba.
- La tabla esperada de `tests/unit/authz.test.ts` se escribe en la prueba, nunca se importa de `matriz.ts`.
