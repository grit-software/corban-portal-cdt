# Epic 01: Fundaciones

> Después de este epic existe un proyecto que construye, se ejecuta y se prueba; una base Postgres con el esquema completo, auditoría inmutable y semilla; autorización centralizada; ingreso de staff y de clientes; y el motor de cálculo de tasas y vencimientos con su administración.

| | |
|---|---|
| **Epic id** | `01-fundaciones` |
| **Tasks** | `E1-T1` … `E1-T7` |
| **Depends on** | nada — empieza aquí (después de §10 Bootstrap) |
| **Unlocks** | `02-solicitudes`, `03-operacion` |
| **Parallel with** | ninguno: los pasos son secuenciales |

No necesitas ningún otro archivo para completar este epic. Todo lo de abajo se repite aquí a propósito.
Los contratos largos (esquema completo, matriz de permisos, motor de cálculo) están **en el proyecto**:
`docs/referencia/esquema.ts.txt` y `docs/referencia/contratos.md` (llegaron con `workspace/`).

---

## Stack

Next.js 16 App Router (`output: "standalone"`, `src/`, `proxy.ts`) · TypeScript 6 · Tailwind v4 ·
PostgreSQL 17 (Docker en local) · Drizzle ORM 0.45 + driver `postgres` · better-auth (Entra para
staff, OTP por correo para clientes) · Vitest + Playwright · Biome. Gestor: `pnpm` 12.16.1
(`packageManager`). Runtime fijado en `.nvmrc` (24). Versiones en `pnpm-lock.yaml`: léelo, nunca
adivines una.

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint / formato | `pnpm lint` · `pnpm format` |
| Test (un archivo) | `pnpm test tests/unit/authz.test.ts` |
| Build + smoke | `pnpm build` · `sh scripts/smoke-standalone.sh /api/health '"status":"ok"'` |
| Migraciones | `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:seed` |
| Base de pruebas | `pnpm db:test:prepare` |
| Servicios locales | `docker compose up -d --wait postgres` / `pnpm services:down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

Las tareas que verifican contra Postgres lo levantan en su propio `Verify`. `docker-compose.yml`,
`.env` (copiado de `.env.example`), `drizzle.config.ts`, `vitest.config.mts`, `tests/setup.ts`,
`scripts/migrate.ts`, `scripts/db-test-prepare.ts` y `scripts/smoke-standalone.sh` ya están en la
raíz: no los escribes, y nunca reemplazas un servicio real por un falso.

## Directory subtree

```
README.md                                  # NUEVO (E1-T1)
pnpm-lock.yaml                             # generado por Bootstrap; se commitea en E1-T1
drizzle/                                   # NUEVO — migraciones que emite `pnpm db:generate` (E1-T2, E1-T3)
scripts/seed.ts                            # NUEVO (E1-T3)
src/
  proxy.ts                                 # NUEVO (E1-T6)
  lib/env.ts                               # existe (workspace) — solo lectura en este epic
  lib/logger.ts                            # NUEVO (E1-T4)
  app/(publico)/                           # page.tsx existe (mínima); E1-T6 la reemplaza y añade páginas
  app/(staff)/coordinador/                 # NUEVO (E1-T7)
  app/api/health/db/route.ts               # NUEVO (E1-T2)
  app/api/auth/[...all]/route.ts           # NUEVO (E1-T5)
  app/api/test/login/route.ts              # NUEVO (E1-T5)
  app/api/v1/                              # NUEVO (E1-T6): auth/registro, auth/invitaciones, consentimiento
  server/db/{schema,client,seed-base}.ts   # NUEVOS (E1-T2, E1-T3)
  server/authz/                            # NUEVO (E1-T4)
  server/auditoria/                        # NUEVO (E1-T4)
  server/auth/                             # NUEVO (E1-T5)
  server/correo/                           # NUEVO (E1-T5)
  server/clientes/acceso/                  # NUEVO (E1-T6)
  server/condiciones/                      # NUEVO (E1-T7)
tests/
  unit/health.test.ts                      # existe (workspace)
  unit/{authz,motor-calculo}.test.ts       # NUEVOS
  integration/{db,esquema,trazabilidad,auth-staff,auth-clientes,condiciones}.test.ts  # NUEVOS
  helpers/fabricas.ts                      # NUEVO (E1-T7)
```

Todo lo que está fuera de este árbol queda fuera de alcance. Si una tarea parece exigir editar un
archivo no listado, detente y repórtalo.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `festivos` | `fecha` (PK date), `nombre`, `created_at` | Única tabla de E1-T2; la semilla la deja vacía |
| Las 20 tablas de `docs/referencia/esquema.ts.txt` | todas | E1-T3 reemplaza `schema.ts` por ese texto completo |
| `audit_events` | solo inserción | Trigger con SQLSTATE `42501` (migración `--custom` de E1-T3) |
| `entidades` | semilla `ban100`, `colte`, `juris`, `mmujer` | `on conflict do nothing` |
| `staff_members` | `email`, `nombre`, `rol`, `activo`, `user_id` | Lista blanca de Entra |
| `user`, `session`, `account`, `verification` | tablas de better-auth 1.7 | Escritas a mano, nunca con el CLI |
| `clientes`, `invitaciones`, `consentimientos`, `rate_limits` | E1-T5, E1-T6 | Correos en minúsculas |
| `condiciones_tasa` | E1-T7 | Validación de solapes en el repositorio |

## Contracts

**Consumed** — ya existe, no lo reconstruyas:

| From | Interface | Guarantee |
|---|---|---|
| workspace | `getEnv()`, `reiniciarEnvParaPruebas()` en `src/lib/env.ts` | Validación perezosa; lanza nombrando la variable |
| workspace | `GET /api/health` | `{status:"ok"}` sin tocar la base |
| workspace | `scripts/smoke-standalone.sh <ruta> <texto> [código] [método]` | Sale 0 solo con el código y el texto esperados |

**Produced** — los epics siguientes dependen de estas firmas exactas:

| Export | Signature | Used by |
|---|---|---|
| `src/server/db/client.ts` → `getDb`, `cerrarDb`, `Db` | `getDb(): Db` · `cerrarDb(): Promise<void>` | todos |
| `src/server/db/seed-base.ts` → `sembrarBase` | `(db: Db, o: { adminEmail: string; demo: boolean }) => Promise<void>` | E1-T7, 02, 03 |
| `src/server/authz/can.ts` → `can` | `(actor: Actor, accion: string, recurso?: { clienteId?: string \| null; asesorId?: string \| null }) => boolean` | todos los servicios |
| `src/server/authz/errores.ts` → `ErrorDominio` | `new ErrorDominio(code, message, fields?)` | todos |
| `src/server/authz/respuestas.ts` → `ok`, `respuestaError`, `leerCuerpo`, `exigirMismoOrigen` | ver nombres | todos los route handlers |
| `src/server/auditoria/` → `conAuditoria` | `(evento, trabajo: (tx: Tx) => Promise<T>) => Promise<T>` | todos los servicios que escriben |
| `src/lib/logger.ts` → `log`, `requestIdDe` | `log.info(mensaje, datos?)` | todos |
| `src/server/auth/actor.ts` → `getActor`, `VERSION_CONSENTIMIENTO` | `(headers: Headers) => Promise<Actor \| null>` | todos los handlers y layouts |
| `src/server/auth/sesion-prueba.ts` → `iniciarSesionPorOtp`, `cookieDe` | `(email) => Promise<Response>` | pruebas, `/api/test/login` |
| `src/server/auth/limite.ts` → `consumirLimite` | `(clave, limite, ventanaSegundos) => Promise<{ permitido: boolean; reintentarEn: number }>` | 02 (firmas), 03 |
| `src/server/auth/staff.ts` → `crearStaff`, `cambiarRolStaff`, `desactivarStaff` | `(actor, …)` | 03 (admin) |
| `src/server/correo/` → `getMailDriver`, `plantillas` | `enviar({ para, asunto, html, texto })` | 02, 03 |
| `src/server/clientes/acceso/` → `crearInvitacion` | `(actor, { tipoDoc, numDoc, nombre, email })` | 02 (`/asesor/clientes`) |
| `src/server/condiciones/` → `calcularCondiciones`, `calcularParaSolicitud`, `opcionesPara`, `valorEnLetras`, `formatoMiles`, `tasaTexto` | ver E1-T7 | 02 |
| `tests/helpers/fabricas.ts` | `crearStaff`, `crearClienteConSesion`, `sesionStaff`, `crearCondicion`, `asegurarEntidades` | 02, 03 |

## Conventions that bite in this area

- **Imports relativos con extensión; alias `@/` sin extensión:** `import { getDb } from "@/server/db/client"`; dentro
  de la carpeta `./schema.ts`. `schema.ts` no importa nada del proyecto.
- **Scripts con tsx sin top-level await:** `main().catch((e) => { console.error(e); process.exit(1); })`.
- **Errores de Postgres envueltos por drizzle 0.45:** el SQLSTATE está en `(error.cause ?? error).code`.
- **Las pruebas nunca truncan** (el trigger bloquea `audit_events`): datos únicos con `crypto.randomUUID()`.
- **Route handlers leen `request.headers`**, nunca `next/headers`; `params` es una `Promise`.
- **`BETTER_AUTH_SECRET` lo exige `getAuth()`**, no `env.ts`, para no romper los gates de E1-T1…T4.
- **Nada lee `getEnv()` al importar** (ni `getDb()`, ni `getAuth()`): `next build` no tiene secretos.
- Termina cada tarea con `pnpm format`.

Reglas del proyecto: `CLAUDE.md`. Reglas por área: `.claude/rules/server.md`, `db.md`, `api-v1.md`,
`pruebas.md`. Ambas cosas están en la raíz del proyecto desde Bootstrap.

---

## Tasks

En el mismo orden que `tasks.json`. Ese orden es el orden de construcción.

### `E1-T1` — Andamiaje y cadena de herramientas

**Depends on:** nada · **Priority:** p0 — metadato para recortes de alcance, no un orden

Bootstrap ya copió el workspace e instaló dependencias. Ejecuta `pnpm format` una vez para
reconciliar el formato de los archivos emitidos, escribe un `README.md` en español (qué es,
requisitos, `sh scripts/bootstrap.sh`, tabla de comandos de `CLAUDE.md`) y deja verdes los gates.
`next build` puede reescribir `tsconfig.json` y crear `next-env.d.ts`: es esperado (tsconfig está
fuera de Biome; next-env.d.ts está en `.gitignore`). No toques `/api/health`: no debe importar la base.

**Files**
- `README.md` — nuevo
- `pnpm-lock.yaml` — generado por Bootstrap, se commitea aquí

**Acceptance**

Copiado del arreglo `acceptance` de esta tarea en `tasks.json` — idéntico tras la normalización de énfasis definida en `agents/blueprint-writer.md` *Acceptance strings*. Cada uno lo decide un comando de abajo, en esta máquina, durante el build.

1. **WHEN** `pnpm lint` se ejecuta desde la raíz con el bundle presente en `blueprints/corban-portal-cdt/` **THE SYSTEM SHALL** terminar con código 0.
2. **WHEN** `pnpm typecheck` se ejecuta **THE SYSTEM SHALL** terminar con código 0 sin errores.
3. **WHEN** `pnpm test` se ejecuta **THE SYSTEM SHALL** pasar `tests/unit/health.test.ts` con 0 pruebas fallidas y terminar con código 0.
4. **WHEN** `pnpm build` se ejecuta **THE SYSTEM SHALL** terminar con código 0 y producir `.next/standalone/server.js`.
5. **WHEN** `sh scripts/smoke-standalone.sh` arranca `.next/standalone/server.js` en el puerto 3100 y pide `GET /api/health` **THE SYSTEM SHALL** responder 200 con un cuerpo JSON cuyo campo `status` vale `ok`.

**Verify** — cada comando, en orden, desde la raíz del proyecto. Cada uno sale 0 cuando la tarea es correcta.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
test -f .next/standalone/server.js
sh scripts/smoke-standalone.sh /api/health '"status":"ok"'
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T1: andamiaje y cadena de herramientas"
git tag step-01-andamiaje
git ls-files --error-unmatch pnpm-lock.yaml
```

Ejecútalos después de que el último comando de Verify salga 0. Si la tarea siguiente sale mal,
`git reset --hard` a este tag en vez de depurar hacia adelante.

### `E1-T2` — Servicios locales, entorno y cliente de BD

**Depends on:** `E1-T1` · **Priority:** p0

Conecta la app a Postgres sin exigir la base al importar. Escribe `schema.ts` con **solo**
`festivos`, el cliente perezoso, la ruta `/api/health/db` y su prueba; luego `pnpm db:generate`
(no se conecta) para que drizzle-kit emita la primera migración con su propio nombre. No escribas
nunca un nombre de archivo de `drizzle/`.

```ts
// src/server/db/schema.ts (solo en este paso)
import { date, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const festivos = pgTable("festivos", {
  fecha: date("fecha", { mode: "string" }).primaryKey(),
  nombre: text("nombre").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// src/server/db/client.ts
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

let conexion: { db: Db; sql: ReturnType<typeof postgres> } | undefined;

export function getDb(): Db {
  if (!conexion) {
    const sql = postgres(getEnv().DATABASE_URL, { max: 10, onnotice: () => undefined });
    conexion = { sql, db: drizzle(sql, { schema }) };
  }
  return conexion.db;
}

export async function cerrarDb(): Promise<void> {
  if (conexion) {
    await conexion.sql.end();
    conexion = undefined;
  }
}
```

`/api/health/db`: `export const dynamic = "force-dynamic"`; `GET` ejecuta `select 1` con
`getDb().execute(…)` (plantilla `sql` de `drizzle-orm`) → `{ status: "ok", db: "ok" }`; si falla,
503 `{ status: "error", db: "error" }`. La prueba: `DATABASE_URL` termina en `/corban_test` y
`select 1` da una fila; insertar (`onConflictDoNothing`) y leer el festivo `2099-12-31`; quitar la
variable con `Reflect.deleteProperty(process.env, "DATABASE_URL")` + `reiniciarEnvParaPruebas()` y
esperar `toThrow(/DATABASE_URL/)` (restaurar en `finally`); `afterAll(cerrarDb)`.

**Files**
- `src/server/db/schema.ts` — nuevo
- `src/server/db/client.ts` — nuevo
- `src/app/api/health/db/route.ts` — nuevo
- `tests/integration/db.test.ts` — nuevo
- `drizzle/**` — la migración que emite `pnpm db:generate` y `drizzle/meta/`

**Acceptance**

Copiado del arreglo `acceptance` de `tasks.json` — idéntico tras la normalización de énfasis.

1. **WHEN** `docker compose up -d --wait postgres` se ejecuta **THE SYSTEM SHALL** terminar con código 0 solo después de que el healthcheck `pg_isready` del servicio `postgres` reporte saludable.
2. **WHEN** `pnpm db:migrate` se ejecuta dos veces seguidas contra `DATABASE_URL` **THE SYSTEM SHALL** terminar con código 0 ambas veces y la tabla `festivos` SHALL existir.
3. **WHEN** `pnpm db:test:prepare` se ejecuta **THE SYSTEM SHALL** recrear la base `corban_test` con todas las migraciones aplicadas y terminar con código 0.
4. **WHEN** `pnpm test tests/integration/db.test.ts` se ejecuta **THE SYSTEM SHALL** ejecutar `select 1` mediante `getDb()` contra `corban_test`, insertar y leer una fila de `festivos`, y terminar con código 0.
5. **WHEN** `DATABASE_URL` no está definida y se llama `getEnv()` **THE SYSTEM SHALL** lanzar un error cuyo mensaje nombra `DATABASE_URL`.
6. **WHEN** el servidor standalone construido por `pnpm build` recibe `GET /api/health/db` **THE SYSTEM SHALL** responder 200 con un cuerpo JSON cuyo campo `db` vale `ok`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:migrate
docker compose exec -T postgres psql -U corban -d corban -tAc "select to_regclass('public.festivos') is not null" | grep -qx t
pnpm db:test:prepare
pnpm test tests/integration/db.test.ts
pnpm typecheck
pnpm lint
pnpm build
sh scripts/smoke-standalone.sh /api/health/db '"db":"ok"'
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T2: servicios locales, entorno y cliente de bd"
git tag step-02-base-datos
```

### `E1-T3` — Esquema completo, auditoría inmutable y semilla

**Depends on:** `E1-T2` · **Priority:** p0

Reemplaza `src/server/db/schema.ts` por el texto completo de `docs/referencia/esquema.ts.txt`
(`festivos` no cambia, así drizzle-kit no pregunta por renombres) y ejecuta `pnpm db:generate`.
Luego `pnpm db:generate --custom --name=auditoria_inmutable` crea un SQL vacío (el más nuevo de
`drizzle/`); escribe en él exactamente:

```sql
CREATE OR REPLACE FUNCTION audit_events_solo_insercion() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events es de solo inserción (operación %)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER audit_events_no_update_delete
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_solo_insercion();
--> statement-breakpoint
CREATE TRIGGER audit_events_no_truncate
  BEFORE TRUNCATE ON audit_events
  FOR EACH STATEMENT EXECUTE FUNCTION audit_events_solo_insercion();
```

`sembrarBase(db, { adminEmail, demo })` (idempotente): entidades `ban100` Ban100
`{ban_vinc,ban_orden}`, `colte` Coltefinanciera `{colte_vinc,colte_cdt}`, `juris` Juriscoop
`{juris}` con `plazoEnMeses` true, `mmujer` Mundo Mujer `{mmujer}` — `monto_minimo` 0,
`calendario`, `siguiente_habil`, `onConflictDoNothing()`; admin con el correo en minúsculas, nombre
"Administración", rol `admin`, `onConflictDoNothing()`; con `demo`, por cada entidad **sin**
condiciones: 90/vencimiento 9.5000 · 180/vencimiento 10.0000 · 180/mensual 9.8000 ·
360/vencimiento 10.5000 · 360/mensual 10.3000, `monto_min` 1000000, `monto_max` nulo,
`vigente_desde` 2026-01-01. Sin festivos. `scripts/seed.ts` lee `ADMIN_EMAIL` (sin ella lanza),
`--demo` de `process.argv`, usa `@/server/db/client` y `@/server/db/seed-base`, `main().catch()`.
La prueba recorre `Object.values(schema)` con `is(v, PgTable)` + `getTableName` (no una lista a mano).

**Files**
- `src/server/db/schema.ts` — edit: esquema completo
- `src/server/db/seed-base.ts` — nuevo
- `scripts/seed.ts` — nuevo
- `tests/integration/esquema.test.ts` — nuevo
- `drizzle/**` — la migración que emite `pnpm db:generate` y la de `--custom --name=auditoria_inmutable`

**Acceptance**

1. **WHEN** `pnpm db:migrate` se ejecuta sobre la base del paso 2 **THE SYSTEM SHALL** terminar con código 0 y cada tabla exportada por `src/server/db/schema.ts` SHALL existir en `corban_test` después de `pnpm db:test:prepare`.
2. **WHEN** se intenta `UPDATE`, `DELETE` o `TRUNCATE` sobre `audit_events` **THE SYSTEM SHALL** fallar con el código SQLSTATE `42501` y dejar la fila sin cambios.
3. **WHEN** `pnpm db:seed` se ejecuta dos veces **THE SYSTEM SHALL** terminar con código 0 ambas veces y dejar exactamente 4 filas en `entidades` (`ban100`, `colte`, `juris`, `mmujer`) y exactamente una fila activa en `staff_members` con rol `admin` para `ADMIN_EMAIL`.
4. **WHEN** se insertan dos `clientes` con el mismo par (`tipo_doc`, `num_doc`) **THE SYSTEM SHALL** rechazar el segundo con violación de unicidad (SQLSTATE `23505`).
5. **WHEN** se inserta una solicitud sin `codigo` **THE SYSTEM SHALL** asignarle un código que cumple `^SOL-\d{6}$`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:migrate
pnpm db:seed
pnpm db:seed
docker compose exec -T postgres psql -U corban -d corban -tAc "select count(*) from entidades" | grep -qx 4
pnpm db:test:prepare
pnpm test tests/integration/esquema.test.ts
pnpm typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T3: esquema completo, auditoria inmutable y semilla"
git tag step-03-esquema
```

### `E1-T4` — Autorización can(), auditoría transaccional y logger

**Depends on:** `E1-T3` · **Priority:** p0

Un solo punto de decisión de permisos y una sola forma de auditar. `Actor` es
`{ tipo: "staff"; userId; staffId; rol; email }` o `{ tipo: "cliente"; userId; clienteId: string | null; email; consentimiento: boolean }`.
`matriz.ts` codifica la matriz de `docs/referencia/contratos.md` §2 como datos; `can()` resuelve
propio/asignado/todos/sí y niega todo a un cliente sin consentimiento salvo `condiciones.ver`.
`conAuditoria(evento, trabajo)` = `getDb().transaction(async (tx) => { const r = await trabajo(tx); await tx.insert(auditEvents).values(evento); return r; })`.
El logger escribe una línea JSON por evento y redacta recursivamente `num_doc`, `numDoc`, `email`,
`celular`, `tel_fijo`, `tel_trab`, `direccion`, `cta_numero`, `ctaNumero`, `otp`, `token`,
`password`, `cookie`, `authorization`. La tabla esperada de la prueba se **escribe en la prueba**,
nunca se importa de `matriz.ts`.

**Files**
- `src/server/authz/**` — nuevo: `actor.ts`, `matriz.ts`, `can.ts`, `errores.ts`, `respuestas.ts`
- `src/server/auditoria/**` — nuevo: `conAuditoria`, tipo `Tx`
- `src/lib/logger.ts` — nuevo
- `tests/unit/authz.test.ts` — nuevo
- `tests/integration/trazabilidad.test.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm test tests/unit/authz.test.ts` se ejecuta **THE SYSTEM SHALL** comparar `can()` contra la tabla esperada de la prueba, que reproduce celda por celda la matriz rol × acción de §8, y terminar con código 0.
2. **WHEN** un actor asesor llama `can()` con la acción `solicitud.ver` sobre un recurso cuyo `asesorId` es otro **THE SYSTEM SHALL** devolver `false`, y **WHEN** un cliente lo hace sobre un recurso cuyo `clienteId` no es el suyo **THE SYSTEM SHALL** devolver `false`.
3. **WHEN** una mutación ejecutada con `conAuditoria()` lanza un error después de escribir **THE SYSTEM SHALL** revertir tanto la mutación como la fila de `audit_events`.
4. **WHEN** una mutación ejecutada con `conAuditoria()` termina bien **THE SYSTEM SHALL** dejar exactamente una fila en `audit_events` con `accion`, `actor_id`, `target_type`, `target_id` y `metadata` del evento.
5. **WHEN** el logger recibe un objeto con las claves `num_doc`, `email`, `celular` o `cta_numero` en cualquier nivel de anidación **THE SYSTEM SHALL** emitir una línea JSON donde esos valores son `[REDACTADO]`.

(La "matriz rol × acción de §8" es la tabla de `docs/referencia/contratos.md` §2.)

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/unit/authz.test.ts
pnpm test tests/integration/trazabilidad.test.ts
pnpm typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T4: autorizacion, auditoria transaccional y logger"
git tag step-04-autorizacion
```

### `E1-T5` — Autenticación del staff (Entra, lista blanca, test-login)

**Depends on:** `E1-T4` · **Priority:** p0

`getAuth()` memoizado (nunca al importar): `drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } })`,
`baseURL` y `trustedOrigins` = `[BETTER_AUTH_URL]`, `secret` ≥ 32 caracteres (si no, lanza
nombrando `BETTER_AUTH_SECRET`), `rateLimit: { enabled: false }`, `session: { expiresIn: 604800, updateAge: 86400 }`,
plugin `emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 5, disableSignUp: false, sendVerificationOTP })`,
`databaseHooks.session.create.before: antesDeCrearSesion`, y `socialProviders.microsoft = { clientId, clientSecret, tenantId, prompt: "select_account" }`
solo con las tres `ENTRA_*` (claves **sin verificar**: `pnpm typecheck` las valida contra los
tipos instalados). `sendVerificationOTP` envía la plantilla `otp` y, solo fuera de producción,
guarda el código en `otpParaPruebas`. `getActor(headers)`: staff activo → actor staff (sesión de
más de 12 h → `null`); si no, cliente (enlaza `clientes.user_id` por correo; `consentimiento` =
fila de `VERSION_CONSENTIMIENTO = "2026-11-v1"`, exportada aquí). El catch-all intercepta
`…/email-otp/send-verification-otp`: correo de staff → 403 `USAR_MICROSOFT`; `consumirLimite`
`otp:<correo>` 5/900 s y `otp-ip:<ip>` 20/900 s → 429 `LIMITE_EXCEDIDO` con `Retry-After`. El
test-login: `NODE_ENV === "production"` o `AUTH_TEST_LOGIN !== "1"` o correo sin staff activo →
404 `NO_ENCONTRADO`; si no, `iniciarSesionPorOtp(email)` (`auth.api.sendVerificationOTP` +
`auth.api.signInEmailOTP({ body, asResponse: true })`). Correo: drivers `file` (JSON
`<MAIL_FILE_DIR>/<Date.now()>-<8 hex>-<para>.json` con `{ para, asunto, html, texto }`), `smtp`
(nodemailer) y `acs` (`EmailClient`, `beginSend` + `pollUntilDone`); las 7 plantillas de
`docs/referencia/contratos.md` §10.

**Files**
- `src/server/auth/**` — nuevo: `auth.ts`, `actor.ts`, `staff.ts`, `limite.ts`, `sesion-prueba.ts`
- `src/server/correo/**` — nuevo: drivers y `plantillas.ts`
- `src/app/api/auth/[...all]/route.ts` — nuevo
- `src/app/api/test/login/route.ts` — nuevo
- `tests/integration/auth-staff.test.ts` — nuevo

**Acceptance**

1. **WHEN** `iniciarSesionPorOtp()` se usa con el correo de un `staff_members` activo **THE SYSTEM SHALL** crear una sesión y `getActor()` SHALL devolver un actor staff con el rol de esa fila.
2. **WHEN** `antesDeCrearSesion()` evalúa la sesión de un usuario con cuenta del proveedor `microsoft` cuyo correo no es un `staff_members` activo **THE SYSTEM SHALL** devolver `false` y no se crea sesión.
3. **WHEN** un administrador desactiva a un miembro del staff con `desactivarStaff()` **THE SYSTEM SHALL** borrar sus sesiones y `getActor()` con la cookie anterior SHALL devolver `null`.
4. **WHEN** `POST /api/test/login` recibe el correo de un staff activo con `AUTH_TEST_LOGIN` en 1 y `NODE_ENV` distinto de `production` **THE SYSTEM SHALL** responder 200 con una cabecera `set-cookie` de sesión; **WHEN** el correo no es de un staff activo **THE SYSTEM SHALL** responder 404.
5. **WHEN** `getAuth()` se inicializa sin `BETTER_AUTH_SECRET` o con menos de 32 caracteres **THE SYSTEM SHALL** lanzar un error que nombra `BETTER_AUTH_SECRET`.
6. **WHEN** faltan `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` o `ENTRA_TENANT_ID` **THE SYSTEM SHALL** arrancar sin el proveedor `microsoft` registrado, sin fallar.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/auth-staff.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T5: autenticacion del staff"
git tag step-05-auth-staff
```

### `E1-T6` — Autenticación de clientes: registro, OTP, invitaciones y consentimiento

**Depends on:** `E1-T5` · **Priority:** p0

Registro (`POST /api/v1/auth/registro`, límite `registro:<ip>` 10/900 s): crea `clientes` con
`user_id` nulo y `origen` `registro`; mismo documento y mismo correo sin usuario → 201 sin
duplicar; mismo documento con otro correo → 409 `DOCUMENTO_REGISTRADO`. Invitación: token de 32
bytes en base64url, se guarda su SHA-256, vence en 7 días, un solo uso; aceptar en transacción
fija `accepted_at`, `clientes.asesor_id` y `user_id`; usada/vencida → 410 `INVITACION_INVALIDA`.
Consentimiento: `VERSION_CONSENTIMIENTO` importada de `@/server/auth/actor`, texto de
`docs/referencia/contratos.md` §8, IP = primer valor de `x-forwarded-for`. Páginas públicas con
`createAuthClient` de `better-auth/react` + `emailOTPClient` (verifica el export al instalar);
código con `inputMode="numeric"` y `autoComplete="one-time-code"`; `/ingreso-staff` con
`dynamic = "force-dynamic"` (lee si Entra está configurado). `src/proxy.ts`: sin cookie
`better-auth.session_token`, `/mi-cuenta…` → `/ingreso?siguiente=<ruta>` y rutas de staff →
`/ingreso-staff`; `matcher` solo de páginas (nunca `/api`); sin `runtime` en el archivo. La prueba
lee el OTP del último JSON de `.data/test-mail` con `/\b(\d{6})\b/` sobre `texto`.

**Files**
- `src/server/clientes/acceso/**` — nuevo
- `src/app/api/v1/**` — nuevo: `auth/registro`, `auth/invitaciones/[token]`, `auth/invitaciones/[token]/aceptar`, `consentimiento`
- `src/app/(publico)/**` — edit `page.tsx` (portada completa) + nuevos `layout.tsx`, `ingreso`, `registro`, `invitacion/[token]`, `consentimiento`, `ingreso-staff`
- `src/proxy.ts` — nuevo
- `tests/integration/auth-clientes.test.ts` — nuevo

**Acceptance**

1. **WHEN** `POST /api/v1/auth/registro` recibe un cuerpo válido **THE SYSTEM SHALL** crear una fila en `clientes` con `user_id` nulo y responder 201; **WHEN** el par (`tipo_doc`, `num_doc`) ya existe con otro correo **THE SYSTEM SHALL** responder 409 con código `DOCUMENTO_REGISTRADO`.
2. **WHEN** `POST /api/auth/email-otp/send-verification-otp` se llama por sexta vez para el mismo correo dentro de 15 minutos **THE SYSTEM SHALL** responder 429 con código `LIMITE_EXCEDIDO` y no escribir archivo de correo.
3. **WHEN** se envía a `POST /api/auth/sign-in/email-otp` el código de 6 dígitos leído del archivo de correo **THE SYSTEM SHALL** crear una sesión y enlazar `clientes.user_id` del cliente con ese correo; **WHEN** el código es incorrecto **THE SYSTEM SHALL** responder con estado 4xx y no crear sesión.
4. **WHEN** un cliente con sesión acepta una invitación vigente **THE SYSTEM SHALL** fijar `invitaciones.accepted_at` y `clientes.asesor_id` al asesor que invitó; **WHEN** la misma invitación se acepta otra vez o tiene más de 7 días **THE SYSTEM SHALL** responder 410 con código `INVITACION_INVALIDA`.
5. **WHEN** un cliente con sesión llama `POST /api/v1/consentimiento` **THE SYSTEM SHALL** guardar una fila en `consentimientos` con `version`, `accepted_at`, `ip` y `user_agent`, y `GET /api/v1/consentimiento` SHALL devolver `aceptado` en `true`.
6. **WHEN** un correo de staff pide un OTP por HTTP **THE SYSTEM SHALL** responder 403 con código `USAR_MICROSOFT`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/auth-clientes.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T6: autenticacion de clientes"
git tag step-06-auth-clientes
```

### `E1-T7` — Condiciones de tasa, festivos y motor de cálculo

**Depends on:** `E1-T6` · **Priority:** p0

El motor es una función pura (`calcularCondiciones`) con el algoritmo de
`docs/referencia/contratos.md` §4: `MONTO_MINIMO`, filas aplicables (entidad, plazo, periodicidad,
rango de monto inclusivo, vigencia que contiene la apertura), 0 → `SIN_CONDICION`, ≥ 2 →
`CONDICION_AMBIGUA`; vencimiento `calendario` o `comercial_360` (meses con tope a fin de mes +
resto en días); ajuste saltando sábados, domingos y festivos; `plazoMeses = Math.round(dias/30)`.
Fechas solo con `Date.UTC`/`getUTCDay`. `en-letras.ts` es el port literal de `enLetras` de
`contratos.md` §4 más `formatoMiles` (sin `Intl`) y `tasaTexto`. El repositorio valida solapes
(`CONDICION_SOLAPADA`) y audita; la UI del coordinador (pestañas Tasas · Entidades · Festivos)
usa elementos nativos con tokens (shadcn llega en el epic 02) y marca «DEMO» las filas con
`creado_por` nulo. La prueba unitaria usa **exactamente** las tablas de casos de `contratos.md` §4
(7 fechas, 4 `plazoMeses`, 7 `valorEnLetras`, `formatoMiles`, `tasaTexto`).

**Files**
- `src/server/condiciones/**` — nuevo: `en-letras.ts`, `motor.ts`, `repositorio.ts`, `opciones.ts`, `calcular.ts`
- `src/app/(staff)/coordinador/**` — nuevo: `condiciones/page.tsx`, `condiciones/acciones.ts`
- `tests/helpers/fabricas.ts` — nuevo
- `tests/unit/motor-calculo.test.ts` — nuevo
- `tests/integration/condiciones.test.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm test tests/unit/motor-calculo.test.ts` se ejecuta **THE SYSTEM SHALL** pasar los 7 casos de vencimiento (calendario y comercial 360, ajuste siguiente y anterior hábil con sábados, domingos y festivos), los de `plazoMeses` y los de `valorEnLetras` de la tabla de fixtures del paso 7, y terminar con código 0.
2. **WHEN** ninguna fila de `condiciones_tasa` aplica a la entidad, valor, plazo, periodicidad y fecha de apertura **THE SYSTEM SHALL** devolver el error `SIN_CONDICION`; **WHEN** aplican dos o más **THE SYSTEM SHALL** devolver `CONDICION_AMBIGUA`.
3. **WHEN** el valor es menor que `entidades.monto_minimo` **THE SYSTEM SHALL** devolver el error `MONTO_MINIMO`.
4. **WHEN** el coordinador guarda una condición cuyo rango de monto y vigencia se cruzan con otra de la misma entidad, plazo y periodicidad **THE SYSTEM SHALL** rechazarla con `CONDICION_SOLAPADA` y no escribir filas.
5. **WHEN** un asesor intenta crear o editar una condición o un festivo **THE SYSTEM SHALL** lanzar `PROHIBIDO` sin escribir filas; **WHEN** lo hace el coordinador **THE SYSTEM SHALL** escribir la fila y una fila de `audit_events`.
6. **WHEN** se consulta `opcionesPara()` para una entidad y un valor **THE SYSTEM SHALL** devolver solo los plazos y periodicidades con condición vigente hoy, cada periodicidad con su `tasaEa`.

(La "tabla de fixtures del paso 7" es la de `docs/referencia/contratos.md` §4, *Casos fijos*.)

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/unit/motor-calculo.test.ts
pnpm test tests/integration/condiciones.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E1-T7: condiciones de tasa, festivos y motor de calculo"
git tag step-07-condiciones
```

---

## Epic acceptance

El epic está hecho cuando cada tarea está `done` **y**:

1. **WHEN** el gate completo corre con Postgres arriba **THE SYSTEM SHALL** terminar con código 0 en typecheck, lint, todas las pruebas y el build, y el smoke de `/api/health/db` SHALL pasar contra el servidor standalone.
2. **WHEN** un cliente sin consentimiento o un asesor no asignado consulta un recurso a través de `can()` **THE SYSTEM SHALL** denegarlo, y ninguna escritura de esta capa SHALL quedar sin su fila de `audit_events`.

```bash
docker compose up -d --wait postgres && pnpm db:test:prepare
pnpm typecheck && pnpm lint && pnpm test
pnpm build && sh scripts/smoke-standalone.sh /api/health/db '"db":"ok"'
```

## Pitfalls

- **Escribir un nombre de migración a mano** — drizzle-kit elige el nombre; refiérete a "la migración que emite `pnpm db:generate`" y nunca la renombres.
- **Importar el proyecto desde `schema.ts`** — drizzle-kit no resuelve alias; el esquema solo importa `drizzle-orm`.
- **Validar `BETTER_AUTH_SECRET` en `env.ts`** — rompería el build de E1-T1…T4 y de Docker; lo exige `getAuth()`.
- **Truncar tablas en pruebas** — el trigger lo impide en `audit_events`; usa datos únicos.
- **`proxy.ts` sobre `/api`** — Next bufferiza el cuerpo en proxy y la autorización real va en cada handler.
- **Fechas en zona local** — el motor usa solo UTC; "hoy" se calcula en America/Bogota en los servicios.
- **Comparar códigos de Postgres en `error.code`** — drizzle 0.45 los envuelve: `(error.cause ?? error).code`.

## Before moving on

- [ ] Cada tarea de este epic está `done` en `tasks.json` — ninguna en `in_progress`.
- [ ] Pasaron todos los comandos `verify` de cada tarea, no solo el primero.
- [ ] No se editó ni se saltó ningún comando `verify`.
- [ ] **Cada tarea tiene su tag `checkpoint`**: `git tag -l 'step-*'` lista `step-01-andamiaje` … `step-07-condiciones`.
- [ ] El gate pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Produced" existe con la firma indicada.
- [ ] No se modificó ningún archivo fuera del subárbol.
- [ ] `.env.example` no necesitó variables nuevas en este epic (todas venían del workspace).
- [ ] Un commit por tarea, cada uno con el id de la tarea y seguido de su tag.
