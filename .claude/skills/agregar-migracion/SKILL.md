---
name: agregar-migracion
description: Cambia el esquema de la base de datos de forma segura (tabla, columna, índice, restricción o SQL a mano). Úsala cuando pidan "agregar una columna", "nueva tabla", "cambiar el esquema", "migración" o "índice".
---

# Agregar una migración

## Cuándo usarla
- Cualquier cambio en `src/server/db/schema.ts`, o SQL que drizzle no expresa (triggers, funciones).

## Pasos
1. Edita `src/server/db/schema.ts` (sin imports del proyecto; solo `drizzle-orm`).
2. Solo **expandir** en este release: columnas nuevas nullable o con default, tablas nuevas, índices.
   Borrar o renombrar columnas va en un release posterior, cuando ningún código las use.
3. `pnpm db:generate` — drizzle-kit elige el nombre del archivo; no lo renombres. Si pregunta por un
   renombre, cancela y separa el cambio en dos migraciones.
4. Para SQL a mano: `pnpm db:generate --custom --name=<descripcion>` y escribe el SQL en el archivo
   más nuevo de `drizzle/`, con `--> statement-breakpoint` entre sentencias.
5. `pnpm db:migrate` (local) y `pnpm db:test:prepare`.
6. Si la tabla es nueva, la prueba `tests/integration/esquema.test.ts` la cubre sola (recorre las
   tablas exportadas por `schema.ts`).

## Verify
```bash
docker compose up -d --wait postgres   # expect: exit 0
pnpm db:migrate                        # expect: exit 0
pnpm db:test:prepare                   # expect: exit 0
pnpm test tests/integration/esquema.test.ts   # expect: exit 0
pnpm typecheck                         # expect: exit 0
```

## No hagas
- No edites una migración ya aplicada en cualquier entorno: crea una nueva.
- No apliques migraciones al arrancar la app: en producción son un paso de release (`pnpm db:migrate`).
- No toques `audit_events` con UPDATE/DELETE: el trigger lo rechaza a propósito.
