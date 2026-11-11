# Corban FC — Portal de CDT

Portal web donde los clientes de Corban FC diligencian una sola vez sus datos y su solicitud de
CDT, descargan los formatos oficiales llenos, suben la firma y ven su portafolio; el staff
(asesor, coordinador, gerencia, admin) valida, aprueba y sigue cada solicitud.

## Comandos

| Tarea | Comando |
|---|---|
| Bootstrap / reejecutar | `sh scripts/bootstrap.sh` |
| Servicios (Postgres) | `pnpm services:up` · `pnpm services:down` |
| Dev | `pnpm dev` — http://localhost:3000 |
| Build | `pnpm build` (salida `.next/standalone/server.js`) |
| Smoke del build | `sh scripts/smoke-standalone.sh /api/health '"status":"ok"'` |
| Typecheck | `pnpm typecheck` |
| Lint / formato | `pnpm lint` · `pnpm format` |
| Pruebas | `pnpm test` · un archivo: `pnpm test tests/unit/authz.test.ts` |
| Base de pruebas | `pnpm db:test:prepare` (recrea `corban_test`; ejecutar tras cada migración) |
| E2E | `pnpm e2e` · un archivo: `pnpm e2e tests/e2e/flujos.spec.ts` |
| Navegador E2E | `pnpm exec playwright install chromium` |
| Migración nueva | `pnpm db:generate` (y `--custom --name=<nombre>` para SQL a mano) |
| Aplicar migraciones | `pnpm db:migrate` |
| Semilla | `pnpm db:seed` · con tasas DEMO: `pnpm db:seed:demo` |
| Inspeccionar BD | `pnpm db:studio` |
| Sesión de staff local | `POST /api/test/login {"email":"asesor.e2e@corbanfc.com"}` (404 en producción) |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como
hecha (con `pnpm services:up` y `pnpm db:test:prepare` antes). Orden del build: `tasks.json` y
`epics/` en `blueprints/corban-portal-cdt/`.

Runtime fijado en `.nvmrc` (24) y `packageManager` (pnpm 12.16.1). Las versiones de dependencias
están en `pnpm-lock.yaml`: léelo, nunca adivines una.

## Stack

Next.js 16 App Router (standalone, `src/`, `proxy.ts`) · TypeScript 6 · Tailwind v4 (`@theme`) ·
shadcn/ui (Radix) · PostgreSQL 17 · Drizzle ORM · better-auth (Entra ID para staff, OTP por
correo para clientes) · react-query · pdf-lib · exceljs · Azure App Service + Flexible Server +
Blob + Communication Services.

## Arquitectura

**Ruta de una petición del cliente.** navegador → `src/components/cliente/api.ts` (fetch) →
`src/app/api/v1/solicitudes/[id]/route.ts` → `getActor(request.headers)`
(`src/server/auth/actor.ts`) → `src/server/solicitudes/servicio.ts` → `can()`
(`src/server/authz/can.ts`) → `conAuditoria()` (`src/server/auditoria/`) → `getDb()`
(`src/server/db/client.ts`) → Postgres. **Staff:** Server Component de `src/app/(staff)/**` llama
el servicio directamente para leer; las mutaciones son server actions (`acciones.ts`) o
`src/app/api/staff/**`, que llaman el mismo servicio y el mismo `can()`.

**Fronteras.** Cruzarlas en la dirección equivocada rompe el build o la seguridad:

| Capa | Puede importar de | Nunca |
|---|---|---|
| `src/app/**` (rutas) | `src/components`, `src/server`, `src/lib` | Consultar tablas directamente |
| `src/components/**` y todo `"use client"` | `src/lib` (puro), otros componentes | `src/server/**`, `src/lib/env.ts` |
| `src/server/<feature>/**` | `src/server/db`, `src/server/authz`, `src/server/auditoria`, `src/lib` | React, `src/components` |
| `src/server/db/schema.ts` | solo `drizzle-orm` | Nada del proyecto (drizzle-kit lo carga sin alias) |
| `src/lib/**` | nada con I/O (salvo `env.ts`, `logger.ts`) | `src/server/**` |

**Dónde vive cada cosa.**

| Tema | Fuente única |
|---|---|
| Esquema de BD | `src/server/db/schema.ts` → `pnpm db:generate` → `pnpm db:migrate` |
| Entorno | `src/lib/env.ts` (`getEnv()`); nunca `process.env` en `src/` fuera de ahí |
| Permisos | `src/server/authz/matriz.ts` + `can()`; matriz en `docs/referencia/contratos.md` §2 |
| Estados de solicitud | `src/server/solicitudes/estados.ts`; tabla en `docs/referencia/contratos.md` §3 |
| Errores | `ErrorDominio` (`src/server/authz/errores.ts`) → `respuestaError()`; códigos en `contratos.md` §1 |
| Tasas y vencimientos | `src/server/condiciones/motor.ts` (puro) — nadie digita tasa ni vencimiento |
| PDFs | `src/server/pdf/` + `assets/formatos/` (PDF y mapeos: nunca se editan a mano) |
| Archivos | `getStorage()` (`src/server/almacenamiento/`): `fs` local, `azure` prod; nunca `public/` |
| Correo | `src/server/correo/` (`file` local: lo leen las pruebas) |
| Tokens de diseño | `src/app/globals.css` `@theme` — sin hex ni px sueltos en componentes |
| Sesión | `getActor()` — el único lector de la sesión |

## Reglas de código

1. **Imports:** relativos con extensión explícita (`./paso-cdt.tsx`, `./schema.ts`); alias `@/` = `src/` **sin** extensión (`@/server/db/client`).
   Sin `../../..` entre directorios de primer nivel. (Los archivos que genera shadcn en
   `src/components/ui/` quedan como los genera.)
2. **Sin barrel files** (`index.ts` que reexporta). Importa del módulo fuente.
3. **Server Components por defecto;** `"use client"` solo en la hoja que necesita estado o eventos.
4. **Valida en el borde:** cada route handler y server action parsea con zod antes del servicio.
5. **Autoriza antes del trabajo:** todo servicio llama `can()` primero; lo que el actor no puede
   ver responde `NO_ENCONTRADO` (404), nunca 403.
6. **Toda mutación de dominio va en `conAuditoria()`** (misma transacción que la escritura).
7. **Errores tipados:** lanza `ErrorDominio(code, message, fields?)`; nunca strings.
8. **Route handlers leen `request.headers`/`request`**, no `next/headers` (se prueban con Vitest).
9. **Dinero = entero en pesos** (`bigint`); fechas de negocio `yyyy-mm-dd`; aritmética de fechas en UTC.
10. **Máximo 300 líneas por componente;** un componente por archivo.
11. Toda página que lee entorno o sesión exporta `dynamic = "force-dynamic"` o lo es por usar
    `headers()`: nada lee `getEnv()` en tiempo de build.
12. Termina cada tarea con `pnpm format`.

## Sistema de diseño

Tokens solo en `src/app/globals.css`; los componentes usan nombres de token.

| Rol | Valor | Uso |
|---|---|---|
| Primario | `#2E6DA4` (hover `#1F4E7A`) | Botones primarios, enlaces, foco |
| Fondo | `#F5F6F7` | Página |
| Superficie | `#FFFFFF` | Tarjetas, paneles, diálogos |
| Borde | `#E2E4E7` (campos `#6B7178`) | Divisores; borde de inputs |
| Texto | `#1B1F23` | Texto principal |
| Texto secundario | `#6B7178` | Ayudas, metadatos (nunca sobre navy) |
| Destructivo | `#C0402C` | Errores, cancelar |
| Éxito | `#2F9E5B` íconos/bordes · `#1E7A45` texto | Confirmaciones |
| Navy | `#1D2226` / `#101317` | Barra lateral del staff (texto blanco) |

- **Tipos:** títulos Poppins 600/700; texto Inter 16/24 (cliente) y 14/20 (staff); mono del sistema para códigos.
- **Escala:** 12 / 14 / 16 / 18 / 20 / 24 / 32 px.
- **Espaciado:** base 4 px — 4, 8, 12, 16, 24, 32, 48, 64. Sin valores arbitrarios.
- **Radio:** 10 px tarjetas, botones y campos; 6 px insignias; completo en avatares.
- **Elevación:** `shadow-card` y `shadow-popover`; nada más fuerte.
- **Movimiento:** 150 ms `ease-out` (200 ms diálogos); siempre con variante `motion-reduce:`.
- **Layout:** mobile-first en cliente (máx. 640 px formularios); staff hasta 1280 px; tablas → tarjetas < 768 px; objetivos táctiles del cliente ≥ 44 px.
- Solo modo claro. Interfaz y textos en español de Colombia.

## Entorno

| Variable | Requerida | Usada por | Fuente |
|---|---|---|---|
| `DATABASE_URL`, `TEST_DATABASE_URL` | sí (paso 2) | `getDb()`, scripts `db:*`, pruebas | `.env.example` |
| `ADMIN_EMAIL` | sí para `db:seed` (paso 3) | `scripts/seed.ts` | correo del admin |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | sí (paso 5) | `getAuth()` | `.env.example`; prod App Settings |
| `AUTH_TEST_LOGIN` | no | `/api/test/login` | `.env.example` = 1 |
| `MAIL_*`, `SMTP_*`, `ACS_CONNECTION_STRING` | según `MAIL_DRIVER` | `src/server/correo/` | `.env.example`; ACS en Azure |
| `STORAGE_*`, `AZURE_STORAGE_*` | según `STORAGE_DRIVER` | `src/server/almacenamiento/` | `.env.example`; Storage en Azure |
| `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID` | solo producción | proveedor Microsoft | registro de app en Entra |

`.env.example` se commitea y se mantiene al día. Ningún `.env` con valores reales se commitea.

## Reglas por área

Lee el archivo correspondiente antes de editar esa área:

| Archivo | Aplica a |
|---|---|
| `.claude/rules/server.md` | `src/server/**` |
| `.claude/rules/api-v1.md` | `src/app/api/v1/**` |
| `.claude/rules/db.md` | `src/server/db/**`, `drizzle/**`, `scripts/**` |
| `.claude/rules/ui.md` | `src/app/**/*.tsx`, `src/components/**` |
| `.claude/rules/pruebas.md` | `tests/**` |

Skills del proyecto: `.claude/skills/agregar-entidad`, `.claude/skills/regenerar-golden`,
`.claude/skills/agregar-migracion`.

## No negociable

1. Ningún dato de un cliente es visible para otro cliente ni para un asesor no asignado: todo pasa por `can()` y `filtroVisibilidad()`, con prueba de aislamiento.
2. `audit_events` es solo inserción (trigger); toda transición y edición del staff deja auditoría con motivo.
3. La tasa, el vencimiento y el valor en letras los calcula el motor; nadie los escribe a mano. Las condiciones se congelan al aprobar.
4. Nunca se registran en logs documento, correo, celular, dirección, número de cuenta, OTP ni tokens.
5. `/api/test/login` responde 404 en producción, siempre.
6. Nunca commitees secretos, `.env` ni salida de build; nunca edites a mano `drizzle/` (salvo la migración `--custom`), `assets/formatos/` ni los snapshots golden.
7. Nunca marques una tarea como hecha con un gate en rojo, ni edites un comando de `verify`.
