---
description: Esquema Drizzle, migraciones y scripts de base de datos
paths:
  - "src/server/db/**"
  - "drizzle/**"
  - "scripts/**"
---

# Base de datos y migraciones

- `src/server/db/schema.ts` es la fuente única del esquema y **no importa nada del proyecto**
  (drizzle-kit lo carga sin alias). Su copia de referencia es `docs/referencia/esquema.ts.txt`.
- `src/server/db/client.ts` es el único lugar que abre conexiones (`getDb()`, perezoso).
- Migraciones: `pnpm db:generate` las nombra; nunca escribas ni renombres un nombre de archivo de
  `drizzle/`. SQL a mano solo con `pnpm db:generate --custom --name=<x>` (archivo más nuevo).
- Nunca edites una migración ya aplicada. Expandir y luego contraer; nada destructivo en el mismo
  release que el código que deja de usarlo.
- Dinero `bigint` en pesos (`mode: "number"`); tasas `numeric(6,4)` (llegan como string);
  fechas de negocio `date` modo string; instantes `timestamptz`.
- `clientes` y `solicitudes` se borran lógicamente (`deleted_at`); toda consulta de listado filtra
  `deleted_at is null`.
- `audit_events` es solo inserción (trigger SQLSTATE 42501). Las pruebas nunca truncan tablas.
- Scripts (`scripts/*.ts`): se ejecutan con `tsx` vía `pnpm db:*` (`dotenv -e .env --` carga el
  entorno); usan `main().catch(...)` (sin top-level await: tsx los corre como CommonJS); importan
  módulos del proyecto con el alias, sin extensión (`@/server/db/client`).
- `scripts/db-test-prepare.ts` solo recrea bases cuyo nombre termina en `_test`.
- La semilla (`sembrarBase`) es idempotente y nunca pisa ajustes del coordinador; los festivos no
  se siembran (no se inventan fechas).
