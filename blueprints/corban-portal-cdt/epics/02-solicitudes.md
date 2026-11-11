# Epic 02: Solicitudes

> Después de este epic un cliente diligencia su solicitud en un asistente mobile-first, el asesor la valida y aprueba, el sistema genera los PDF oficiales versionados, el cliente sube su firma y el staff trabaja en una bandeja con edición con motivo, versiones y reasignación.

| | |
|---|---|
| **Epic id** | `02-solicitudes` |
| **Tasks** | `E2-T1` … `E2-T7` |
| **Depends on** | `01-fundaciones` |
| **Unlocks** | `03-operacion` |
| **Parallel with** | ninguno (dentro del epic, `E2-T4` solo toca `src/server/pdf/**` y puede ir junto a `E2-T3`) |

No necesitas ningún otro archivo para completar este epic. Todo lo de abajo se repite aquí a propósito.
Contratos largos dentro del proyecto: `docs/referencia/contratos.md` (errores §1, permisos §2,
estados §3, motor de cálculo §4, motor PDF §5, catálogos y campos §6, fixture §7, correos §10).

---

## Stack

Next.js 16 App Router (`output: "standalone"`, `src/`, `proxy.ts`) · TypeScript 6 · Tailwind v4
(`@theme` en `src/app/globals.css`) · shadcn/ui (Radix) · PostgreSQL 17 · Drizzle ORM ·
better-auth · @tanstack/react-query · react-hook-form + zod · pdf-lib · Vitest + Playwright ·
Biome. Gestor: `pnpm` 12.16.1. Runtime en `.nvmrc` (24). Versiones en `pnpm-lock.yaml`.

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint / formato | `pnpm lint` · `pnpm format` |
| Test (un archivo) | `pnpm test tests/integration/estados.test.ts` |
| E2E (un archivo) | `pnpm e2e tests/e2e/asistente.spec.ts` |
| Navegador E2E | `pnpm exec playwright install chromium` |
| Base de pruebas | `pnpm db:test:prepare` |
| Servicios locales | `docker compose up -d --wait postgres` / `pnpm services:down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

Las tareas que verifican contra Postgres lo levantan en su `Verify`. `playwright.config.ts` y
`tests/e2e/preparar.ts` (globalSetup: recrea `corban_test`, `pnpm db:seed:demo` y staff E2E
`asesor.e2e@corbanfc.com`, `asesor2.e2e@corbanfc.com`, `coordinador.e2e@corbanfc.com`,
`gerencia.e2e@corbanfc.com`, `admin.e2e@corbanfc.com`) ya existen. Las E2E corren contra
`pnpm dev` en `http://127.0.0.1:3200` con la base de pruebas; los correos van a `.data/e2e-mail`.
En Linux sin librerías de Chromium: `sudo pnpm exec playwright install-deps chromium` una vez.

## Directory subtree

```
components.json · src/lib/utils.ts · src/components/ui/**   # los genera shadcn (E2-T1)
src/
  app/globals.css                        # existe — E2-T1 añade una línea (tw-animate-css)
  app/layout.tsx                         # existe — E2-T1: fuentes locales y "Saltar al contenido"
  app/(publico)/layout.tsx               # existe (E1-T6) — E2-T1 lo pasa a ShellPublico
  app/(cliente)/mi-cuenta/               # NUEVO: layout (E2-T1), páginas (E2-T3)
  app/(staff)/layout.tsx                 # NUEVO (E2-T1)
  app/(staff)/asesor/                    # NUEVO (E2-T7)
  app/api/v1/                            # existe (E1-T6) — E2-T2, E2-T5, E2-T6 añaden rutas
  app/api/staff/solicitudes/             # NUEVO (E2-T5, E2-T6)
  components/shell/                      # NUEVO (E2-T1)
  components/cliente/                    # NUEVO (E2-T3, E2-T6)
  components/staff/                      # NUEVO (E2-T7)
  lib/datos/                             # NUEVO (E2-T2) — catálogos y esquemas zod (puros)
  server/solicitudes/                    # NUEVO (E2-T2), crece en E2-T5 y E2-T7
  server/almacenamiento/                 # NUEVO (E2-T5)
  server/pdf/                            # NUEVO (E2-T4)
  server/firmas/                         # NUEVO (E2-T6)
  server/condiciones/                    # existe (E1-T7) — solo lectura
  server/auth/, server/authz/, server/auditoria/, server/correo/   # existen — solo lectura
assets/formatos/                         # existe — 6 PDF + mapping.json + mapping.cuenta-pago.json; nunca editar
tests/
  unit/{contraste,pdf-mapeo,pdf-golden}.test.ts       # NUEVOS
  unit/__snapshots__/pdf-<docKey>.json                # los escribe Vitest (E2-T4)
  fixtures/cliente-ejemplo.json                       # NUEVO (E2-T4)
  integration/{api-v1,aislamiento,estados,firmas,asesor}.test.ts   # NUEVOS
  e2e/{responsive.spec.ts,asistente.spec.ts,apoyo.ts}              # NUEVOS
  helpers/fabricas.ts                                 # existe (E1-T7) — usar
```

Todo lo que está fuera de este árbol queda fuera de alcance.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `solicitudes` | `estado`, `datos`, `version_actual`, congelados (`valor`, `plazo_dias`, `periodicidad`, `tasa_ea`, `fecha_apertura`, `fecha_venc`, `condicion_id`), `aprobada_*`, `fecha_envio`, `radicado`, `observacion`, `motivo_cancelacion` | `codigo` generado `SOL-000001` |
| `solicitud_versiones` | `numero`, `datos`, `condiciones`, `motivo` | único (solicitud_id, numero) |
| `documentos` | `version`, `tipo` generado/firmado, `doc_key`, `storage_path`, `sha256`, `bytes`, `estado`, `motivo_rechazo` | Archivos solo vía `StorageDriver` |
| `solicitud_eventos` | `tipo`, `desde`, `hacia`, `nota`, `notificado_at` | Una fila por transición |
| `clientes` | `perfil` (se actualiza al enviar), `asesor_id` (reasignación) | — |
| `audit_events` | una fila por mutación; diffs en `metadata.cambios` | Solo inserción |

## Contracts

**Consumed** — ya existe, no lo reconstruyas:

| From | Interface | Guarantee |
|---|---|---|
| `01-fundaciones` | `getDb()`, tablas de `@/server/db/schema` | Conexión perezosa |
| `01-fundaciones` | `can(actor, accion, recurso)`, `ErrorDominio`, `respuestaError`, `leerCuerpo`, `exigirMismoOrigen` | Matriz de `contratos.md` §2 |
| `01-fundaciones` | `conAuditoria(evento, trabajo)` | Mutación + auditoría en una transacción |
| `01-fundaciones` | `getActor(headers)`, `iniciarSesionPorOtp(email)`, `cookieDe(res)` | Actor o `null` |
| `01-fundaciones` | `calcularParaSolicitud`, `opcionesPara`, `valorEnLetras`, `formatoMiles`, `tasaTexto` | Motor puro de `contratos.md` §4 |
| `01-fundaciones` | `crearInvitacion`, `consumirLimite`, `getMailDriver` | — |
| `01-fundaciones` | `tests/helpers/fabricas.ts` | `crearStaff`, `crearClienteConSesion`, `sesionStaff`, `crearCondicion`, `asegurarEntidades` |

**Produced** — el epic 03 depende de estas firmas exactas:

| Export | Signature | Used by |
|---|---|---|
| `src/server/solicitudes/estados.ts` → `TRANSICIONES`, `puedeTransicionar` | `(estado, accion, actor) => boolean` | `03-operacion` |
| `src/server/solicitudes/transiciones.ts` → `ejecutarTransicion` | `(actor, id, accion, entrada) => Promise<Solicitud>` | `03-operacion` (constituir) |
| `src/server/solicitudes/notificaciones.ts` → `notificarTransicion` | `(evento) => Promise<void>` (stub que registra; nunca lanza) | `03-operacion` lo completa |
| `src/server/solicitudes/visibilidad.ts` → `filtroVisibilidad` | `(actor) => SQL` | `03-operacion` |
| `src/server/solicitudes/servicio.ts` → `crearBorrador` | `(actor, { entidadId }) => Promise<Solicitud>` (precarga desde `clientes.perfil`) | `03-operacion` (importación) |
| `src/server/almacenamiento/` → `getStorage` | `StorageDriver { put, get, delete, signedUrl }` | `03-operacion` (rechazos .xlsx) |
| `src/server/pdf/` → `generarPdf`, `derivarDatosPdf` | `(docKey, D) => Promise<{ bytes, reporte }>` | — |
| `src/lib/datos/` → catálogos, `etiqueta`, esquemas por paso, `CLAVES_PERFIL` | — | `03-operacion` (importación) |
| `src/components/staff/` → `TablaPaginada`, `LineaDeTiempo`, `InsigniaEstado`, `DialogoMotivo` | — | `03-operacion` |
| `tests/e2e/apoyo.ts` → `iniciarSesionStaff`, `leerOtp`, `registrarClienteYConsentir` | — | `03-operacion` (E3-T5) |

## Conventions that bite in this area

- **Tokens solo de `src/app/globals.css`**; sin hex ni px arbitrarios. Texto de éxito con
  `success-strong` (`#2F9E5B` no llega a 4,5:1 como texto). Texto sobre navy siempre blanco.
- **Un componente cliente nunca importa `src/server/**`**: el asistente habla con `/api/v1` vía
  react-query; el staff lee en Server Components y muta con server actions.
- **Transiciones solo con `ejecutarTransicion()`** (`select … for update`, tabla de estados, evento
  + auditoría en la misma transacción). Efectos externos (correo, borrar archivos) después del commit.
- **Route handlers leen `request`**, `context.params` es una `Promise`; `export const dynamic = "force-dynamic"`.
- **Tipo de archivo por bytes** (`%PDF-`, `FF D8 FF`, firma PNG), nunca por MIME; suma de tamaños antes de leer.
- **El motor PDF sigue el orden exacto:** cargar → deduplicar widgets → limpiar → aplicar → apariencias Helvetica → guardar. `notFound` no vacío revierte la aprobación.
- **Snapshots golden:** los escribe Vitest en la primera ejecución **local** (con `CI` definido no se escriben); se commitean.
- Termina cada tarea con `pnpm format`.

Reglas del proyecto: `CLAUDE.md`. Reglas por área: `.claude/rules/ui.md`, `server.md`,
`api-v1.md`, `pruebas.md`. Skill para cambios intencionales del golden: `.claude/skills/regenerar-golden`.

---

## Tasks

En el mismo orden que `tasks.json`.

### `E2-T1` — Sistema de diseño y shells

**Depends on:** `E1-T6`, `E1-T7` · **Priority:** p0

1) `pnpm dlx shadcn@4.23.0 init --base radix --no-monorepo` (si aún pregunta, repetir con la
opción no interactiva que liste `--help`, p. ej. `--defaults`). 2) `git checkout -- src/app/globals.css`
para restaurar los tokens y añadir **una** línea `@import "tw-animate-css";` justo después de
`@import "tailwindcss";`. 3) `pnpm dlx shadcn@4.23.0 add button input label select textarea checkbox radio-group dialog sheet dropdown-menu table badge card tabs alert skeleton separator --yes --overwrite`
(si vuelve a tocar `globals.css`, repetir 2). 4) Raíz con `next/font/local`: Inter
`./fonts/inter-latin.woff2` peso `100 900`, `variable: "--font-inter"`; Poppins 500/600/700,
`variable: "--font-poppins"`; ambos `display: "swap"`; `<html lang="es-CO">`; `SaltarAlContenido`
primero en `<body>` hacia `#contenido`. `inter-latin-ext.woff2` no se carga. 5) Layouts:
`(publico)` → `ShellPublico`; `(cliente)/mi-cuenta` → `getActor(await headers())` (sin sesión
`/ingreso`, staff `/asesor`, sin `clienteId` «Completa tu registro», sin consentimiento
`/consentimiento`) + `ShellCliente` (navegación inferior en móvil); `(staff)` → solo staff activo
+ `ShellStaff` (barra navy ≥ 1024 px, `Sheet` < 1024 px, nav filtrada por `can()`). 6) Prueba de
contraste: extrae `--color-<nombre>: #rrggbb` de `globals.css` y exige ≥ 4,5 en foreground/background,
foreground/card, muted-foreground/background, muted-foreground/card, primary/background,
primary/card, primary-foreground/primary, primary-foreground/primary-dark, card/navy,
destructive/background, destructive/card, destructive-foreground/destructive,
success-strong/card, success-strong/background, card/success-strong,
secondary-foreground/secondary. 7) Spec responsive con sesión de coordinador por
`page.request.post("/api/test/login", { data: { email: "coordinador.e2e@corbanfc.com" } })`.

**Files**
- `src/app/globals.css` — edit: línea de `tw-animate-css`
- `src/app/**/layout.tsx` — edit raíz y `(publico)`; nuevos `(cliente)/mi-cuenta/layout.tsx` y `(staff)/layout.tsx`
- `src/components/**` — nuevos `shell/*`; `ui/*` generados por shadcn
- `tests/unit/contraste.test.ts` — nuevo
- `tests/e2e/responsive.spec.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm test tests/unit/contraste.test.ts` se ejecuta **THE SYSTEM SHALL** leer los colores de `src/app/globals.css` y comprobar que cada par texto/fondo de la lista de la prueba tiene contraste WCAG de al menos 4.5, terminando con código 0.
2. **WHEN** `pnpm e2e tests/e2e/responsive.spec.ts` se ejecuta a 375, 768 y 1440 px de ancho **THE SYSTEM SHALL** comprobar `scrollWidth <= clientWidth` del elemento raíz en `/`, `/ingreso`, `/registro`, `/ingreso-staff` y `/coordinador/condiciones` con sesión de coordinador obtenida por `/api/test/login`.
3. **WHEN** se renderiza cualquiera de esas páginas **THE SYSTEM SHALL** tener `lang` en `es-CO` en el elemento `html`, un único `h1` y el enlace «Saltar al contenido» como primer elemento enfocable.
4. **WHEN** un visitante sin sesión pide `/mi-cuenta` o `/asesor` **THE SYSTEM SHALL** redirigirlo a `/ingreso` o a `/ingreso-staff` respectivamente.
5. **WHEN** `pnpm build` se ejecuta **THE SYSTEM SHALL** terminar con código 0 con `src/app/layout.tsx` cargando Inter y Poppins mediante `next/font/local` con la opción `display` en `swap`.

**Verify**

```bash
pnpm exec playwright install chromium
docker compose up -d --wait postgres
pnpm test tests/unit/contraste.test.ts
pnpm e2e tests/e2e/responsive.spec.ts
pnpm typecheck
pnpm lint
pnpm build
grep -q 'display: "swap"' src/app/layout.tsx
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T1: sistema de diseno y shells"
git tag step-08-diseno
```

### `E2-T2` — API v1 del cliente: perfil, solicitudes, borrador y envío

**Depends on:** `E1-T6`, `E1-T7` · **Priority:** p0

`src/lib/datos/`: catálogos de `contratos.md` §6 como `[valor, etiqueta][]` y `etiqueta()`; un
esquema zod parcial por paso (`cdt`, `personal`, `laboral`, `financiera`, `pago`; dinero
`/^\d{0,15}$/`, fechas `/^\d{4}-\d{2}-\d{2}$/`); `esquemaEnvio` con las obligatorias de §6;
`CLAVES_PERFIL`. `estados.ts` codifica la tabla de `contratos.md` §3 como datos. `servicio.ts`:
`crearBorrador` (precarga `datos` desde `clientes.perfil`, `asesor_id` del cliente),
`actualizarPaso` (solo claves del paso; cliente solo en `borrador`/`devuelta`), `enviar`
(validación → `calcularParaSolicitud` → transición + evento + auditoría + copia a `clientes.perfil`
en una transacción), `listarMias`, `obtenerSolicitud` con `filtroVisibilidad` dentro del `WHERE`
(lo ajeno es `NO_ENCONTRADO`). Rutas: `perfil` (GET, PATCH), `condiciones/opciones` (GET),
`solicitudes` (GET, POST), `solicitudes/[id]` (GET con eventos, PATCH `{ paso, datos }`),
`solicitudes/[id]/enviar` (POST); cada una `getActor(request.headers)` → 401, `exigirMismoOrigen`
en mutaciones, `respuestaError`.

**Files**
- `src/server/solicitudes/**` — nuevo: `estados.ts`, `servicio.ts`, `perfil.ts`, `visibilidad.ts`
- `src/lib/datos/**` — nuevo: `catalogos.ts`, `esquemas.ts`
- `src/app/api/v1/**` — nuevas rutas `perfil`, `condiciones/opciones`, `solicitudes`, `solicitudes/[id]`, `solicitudes/[id]/enviar`
- `tests/integration/api-v1.test.ts` — nuevo
- `tests/integration/aislamiento.test.ts` — nuevo

**Acceptance**

1. **WHEN** un cliente con consentimiento hace `POST /api/v1/solicitudes` con un `entidadId` válido **THE SYSTEM SHALL** responder 201 con `data.estado` en `borrador`, `data.codigo` que cumple `^SOL-\d{6}$` y `datos` precargados desde `clientes.perfil`.
2. **WHEN** `PATCH /api/v1/solicitudes/{id}` recibe `paso` y `datos` de un borrador propio **THE SYSTEM SHALL** fusionar solo las claves de ese paso, validarlas con su esquema zod y responder 200; **WHEN** la solicitud no está en `borrador` ni `devuelta` **THE SYSTEM SHALL** responder 409 con código `TRANSICION_INVALIDA`.
3. **WHEN** `POST /api/v1/solicitudes/{id}/enviar` se llama con campos obligatorios vacíos **THE SYSTEM SHALL** responder 422 con código `VALIDACION` y `fields` listando cada clave faltante, sin cambiar el estado.
4. **WHEN** el envío es válido pero el motor no encuentra condición aplicable **THE SYSTEM SHALL** responder 422 con código `SIN_CONDICION`; **WHEN** es válido y hay condición **THE SYSTEM SHALL** pasar a `pendiente_validacion` y escribir un `solicitud_eventos` y un `audit_events`.
5. **WHEN** el cliente A pide `GET /api/v1/solicitudes/{id}` de una solicitud del cliente B **THE SYSTEM SHALL** responder 404 con código `NO_ENCONTRADO`, y **WHEN** un asesor no asignado llama `obtenerSolicitud()` sobre ella **THE SYSTEM SHALL** lanzar `NO_ENCONTRADO`.
6. **WHEN** un cliente sin consentimiento llama cualquier ruta `/api/v1/solicitudes` **THE SYSTEM SHALL** responder 403 con código `CONSENTIMIENTO_REQUERIDO`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/api-v1.test.ts
pnpm test tests/integration/aislamiento.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T2: api v1 del cliente"
git tag step-09-api-v1
```

### `E2-T3` — Asistente del cliente (mobile-first)

**Depends on:** `E2-T1`, `E2-T2` · **Priority:** p0

Páginas: inicio (`/mi-cuenta`: mis solicitudes con estado y siguiente paso, «Abrir un CDT»),
`solicitudes/nueva` (tarjetas de entidad → `POST` → `editar?paso=cdt`), `solicitudes/[id]/editar`
(asistente CDT → Personal → Laboral → Financiera → Pago de intereses y cuenta → Resumen) y
`solicitudes/[id]` (línea de tiempo, observación y el componente `documentos-solicitud.tsx`, que
en este paso solo muestra «Tus formatos aparecerán aquí cuando tu asesor apruebe la solicitud» sin
llamar a la API; `E2-T6` lo amplía). El layout de `mi-cuenta` añade
`ProveedorConsultas` (`staleTime` 30 s). Cada paso: react-hook-form + `zodResolver` del esquema de
`src/lib/datos/`; dinero con `inputMode="numeric"` y miles con punto al mostrar; plazos como chips
desde `/api/v1/condiciones/opciones` (Juriscoop muestra meses); periodicidades con su tasa;
autoguardado con `PATCH` al pulsar «Siguiente»/«Anterior» y *debounce* de 1,5 s; error en texto
junto al campo (`aria-describedby`), resumen con `role="alert"`, foco al primer inválido;
objetivos ≥ 44 px. `apoyo.ts` reúne los ayudantes E2E; la spec responsive pasa a usarlos.

**Files**
- `src/app/(cliente)/mi-cuenta/**` — nuevos `page.tsx`, `solicitudes/nueva`, `solicitudes/[id]`, `solicitudes/[id]/editar`; edit `layout.tsx`
- `src/components/cliente/**` — nuevo: `proveedor-consultas.tsx`, `api.ts`, hooks, `asistente.tsx`, un componente por paso
- `tests/e2e/apoyo.ts` — nuevo: `iniciarSesionStaff`, `leerOtp`, `registrarClienteYConsentir`
- `tests/e2e/asistente.spec.ts` — nuevo
- `tests/e2e/responsive.spec.ts` — edit: añade `/mi-cuenta` y `/mi-cuenta/solicitudes/nueva`

**Acceptance**

1. **WHEN** un cliente de prueba completa los pasos CDT → personal → laboral → financiera → pago de intereses y cuenta → resumen y pulsa «Enviar a validación» **THE SYSTEM SHALL** mostrar el estado «Pendiente de validación» en `/mi-cuenta/solicitudes/{id}`.
2. **WHEN** el cliente recarga la página a mitad del asistente **THE SYSTEM SHALL** restaurar todos los valores guardados por el autoguardado del paso anterior.
3. **WHEN** un campo obligatorio está vacío y el cliente pulsa «Siguiente» **THE SYSTEM SHALL** permanecer en el paso, mostrar el error en texto junto al campo y mover el foco al primer campo inválido.
4. **WHEN** se muestra el paso de pago de intereses **THE SYSTEM SHALL** listar solo las periodicidades que `GET /api/v1/condiciones/opciones` devuelve para la entidad, plazo y valor elegidos, cada una con su tasa E.A.
5. **WHEN** `pnpm e2e tests/e2e/responsive.spec.ts` se ejecuta **THE SYSTEM SHALL** no reportar desbordamiento horizontal en `/mi-cuenta` ni en `/mi-cuenta/solicitudes/nueva` a 375, 768 y 1440 px.

**Verify**

```bash
pnpm exec playwright install chromium
docker compose up -d --wait postgres
pnpm e2e tests/e2e/asistente.spec.ts
pnpm e2e tests/e2e/responsive.spec.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T3: asistente del cliente"
git tag step-10-asistente
```

### `E2-T4` — Motor PDF y pruebas golden de los 6 formatos

**Depends on:** `E1-T7`, `E2-T2` · **Priority:** p0

Port del POC en `src/server/pdf/` con el algoritmo de `contratos.md` §5, en este orden exacto:
cargar `assets/formatos/<docKey>.pdf` (`ignoreEncryption: true`) → **deduplicar widgets**
(cada `PDFTextField` con 2+ widgets: de `i` = último a 1, si un `j < i` tiene rectángulo a menos
de 3 pt en x, y, ancho y alto, quitar `Kids[i]` del `Annots` de todas las páginas y
`acroField.removeWidget(i)`) → **limpiar** (texto `setText(undefined)`, casilla `uncheck()`, radio y
listas `clear()`) → **aplicar** filas de `mapping.json[docKey]` y luego `mapping.cuenta-pago.json[docKey]`
(`t`, `d`, `c`, `x`, `s`, `tv`, `ch`; **marcar** = casilla `check()`, radio primera opción,
**campo de texto `"X"`**; `mismo()` sin mayúsculas, sin tildes, `trim`, `o` final ≡ `a`; Latin-1
o `?`; `formatoMiles` sin `$`) → `updateFieldAppearances(Helvetica)` → `save()`. `derivarDatosPdf`
según `contratos.md` §5. El fixture es exactamente el JSON de `contratos.md` §7. El golden: por
cada `docKey`, `notFound` vacío, reabrir los bytes, `{ campoMapeado: texto | marcado | opción }`
ordenado, `JSON.stringify(valores, null, 2) + "\n"` con `toMatchFileSnapshot("./__snapshots__/pdf-<docKey>.json")`,
campos no mapeados vacíos y ningún campo de texto con dos widgets a < 3 pt. Corre la prueba en
local (sin `CI`) para que se escriban los snapshots; abre los PDF generados (escritos en
`.data/golden/`) y compáralos con el POC antes de commitear.

**Files**
- `src/server/pdf/**` — nuevo: `mapeo.ts`, `derivar.ts`, `motor.ts`, `nombres.ts`
- `tests/fixtures/cliente-ejemplo.json` — nuevo (contenido de `contratos.md` §7)
- `tests/unit/pdf-mapeo.test.ts` — nuevo
- `tests/unit/pdf-golden.test.ts` — nuevo
- `tests/unit/__snapshots__/**` — los 6 `pdf-<docKey>.json` que escribe Vitest

**Acceptance**

1. **WHEN** `pnpm test tests/unit/pdf-golden.test.ts` se ejecuta **THE SYSTEM SHALL** generar los 6 documentos `ban_vinc`, `ban_orden`, `colte_vinc`, `colte_cdt`, `juris` y `mmujer` con `tests/fixtures/cliente-ejemplo.json` y el reporte de cada uno SHALL tener `notFound` vacío.
2. **WHEN** cada PDF generado se vuelve a abrir con pdf-lib **THE SYSTEM SHALL** producir un JSON de todos los campos mapeados con su valor o marca idéntico al snapshot commiteado en `tests/unit/__snapshots__/pdf-<docKey>.json`.
3. **WHEN** se inspeccionan los campos que no aparecen en ningún mapeo de ese documento **THE SYSTEM SHALL** encontrarlos vacíos: texto vacío, casilla sin marcar y radio sin selección.
4. **WHEN** se inspeccionan los widgets de cada campo de texto después de generar **THE SYSTEM SHALL** no encontrar dos widgets del mismo campo con rectángulos a menos de 3 pt entre sí.
5. **WHEN** una fila de mapeo de tipo `ch` pide el índice 2 de `cta_numero` igual a `12345678901` **THE SYSTEM SHALL** escribir `3`, y **WHEN** el índice está fuera de rango **THE SYSTEM SHALL** dejar el campo vacío.
6. **WHEN** una fila de tipo `c` compara `soltero` con `Soltera` o `si` con `Sí` **THE SYSTEM SHALL** marcar la casilla, porque la comparación ignora mayúsculas y tildes y trata la `o` final como `a`.

**Verify**

```bash
pnpm test tests/unit/pdf-mapeo.test.ts
pnpm test tests/unit/pdf-golden.test.ts
pnpm test tests/unit/pdf-golden.test.ts
test -f tests/unit/__snapshots__/pdf-ban_vinc.json
test -f tests/unit/__snapshots__/pdf-ban_orden.json
test -f tests/unit/__snapshots__/pdf-colte_vinc.json
test -f tests/unit/__snapshots__/pdf-colte_cdt.json
test -f tests/unit/__snapshots__/pdf-juris.json
test -f tests/unit/__snapshots__/pdf-mmujer.json
pnpm typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T4: motor pdf y golden de los 6 formatos"
git tag step-11-motor-pdf
git ls-files --error-unmatch tests/unit/__snapshots__/pdf-mmujer.json
```

### `E2-T5` — Máquina de estados, validación del asesor y PDFs versionados

**Depends on:** `E2-T2`, `E2-T4` · **Priority:** p0

`StorageDriver { put, get, delete, signedUrl }`: `fs` bajo `STORAGE_FS_ROOT` (rechaza `..`;
`signedUrl` → `null`, el handler entrega los bytes) y `azure` (`fromConnectionString` +
`generateSasUrl` de lectura 300 s, o `DefaultAzureCredential` + `getUserDelegationKey` +
`generateBlobSASQueryParameters`; contenedor privado). `ejecutarTransicion(actor, id, accion,
entrada)`: transacción con `select … for update`, `can()`, `puedeTransicionar()`, efecto, evento y
auditoría (`solicitud.<accion>`); acciones `aprobar`, `devolver` (`observacion` obligatoria →
`MOTIVO_REQUERIDO`), `cancelar` (`motivo`), `enviar_entidad` (`fechaEnvio`, `radicado?`) y `enviar`
migrado aquí. Aprobar: `fecha_apertura` ≥ hoy (America/Bogota) o `FECHA_APERTURA_PASADA`; congela
los 7 campos; versión 1 y `solicitud_versiones` 1; un PDF por `doc_key` (`derivarDatosPdf` →
`generarPdf` → `put("solicitudes/<id>/v1/<archivo>")` → `documentos` con sha256); `notFound` no
vacío → error y rollback; si falla, borra lo subido. `notificaciones.ts` es un stub que solo
registra; se llama después del commit. Descarga del cliente: `fs` → bytes `application/pdf` con
`content-disposition: attachment`; `azure` → 302 a la SAS.

**Files**
- `src/server/solicitudes/**` — nuevos `transiciones.ts`, `aprobacion.ts`, `documentos.ts`, `notificaciones.ts` (stub)
- `src/server/almacenamiento/**` — nuevo
- `src/app/api/staff/solicitudes/**` — nuevos `[id]/[accion]/route.ts`, `[id]/documentos/[docId]/route.ts`
- `src/app/api/v1/solicitudes/**` — nuevos `[id]/documentos/route.ts`, `[id]/documentos/[docId]/route.ts`
- `tests/integration/estados.test.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm test tests/integration/estados.test.ts` se ejecuta **THE SYSTEM SHALL** comprobar cada fila de la tabla de transiciones (estado origen, acción, rol) y que toda combinación fuera de la tabla responde `TRANSICION_INVALIDA` (409) sin escribir filas.
2. **WHEN** el asesor asignado aprueba una solicitud en `pendiente_validacion` **THE SYSTEM SHALL**, en una transacción, copiar `valor`, `plazo_dias`, `periodicidad`, `tasa_ea`, `fecha_apertura`, `fecha_venc` y `condicion_id` a la solicitud, crear `solicitud_versiones` número 1, guardar un PDF por cada `doc_key` de la entidad con `version` 1 y `sha256`, y pasar a `pendiente_firma`.
3. **WHEN** el asesor devuelve sin observación **THE SYSTEM SHALL** responder 422 con código `MOTIVO_REQUERIDO` y conservar el estado.
4. **WHEN** el cliente dueño pide `GET /api/v1/solicitudes/{id}/documentos/{docId}` **THE SYSTEM SHALL** responder 200 `application/pdf` cuyos bytes tienen el `sha256` guardado; **WHEN** lo pide otro cliente **THE SYSTEM SHALL** responder 404.
5. **WHEN** cualquier transición se completa **THE SYSTEM SHALL** escribir exactamente una fila en `solicitud_eventos` y una en `audit_events` con `accion` igual a `solicitud.` seguido del nombre de la acción.
6. **WHEN** el driver de almacenamiento `fs` guarda un archivo **THE SYSTEM SHALL** escribirlo bajo `STORAGE_FS_ROOT` y `get()` SHALL devolver los mismos bytes, sin escribir nada bajo `public/`.

(La tabla de transiciones es la de `docs/referencia/contratos.md` §3.)

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/estados.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T5: maquina de estados, validacion y pdfs versionados"
git tag step-12-validacion
```

### `E2-T6` — Carga del documento firmado y revisión

**Depends on:** `E2-T3`, `E2-T5` · **Priority:** p0

`tipoPorBytes`: `%PDF-` → PDF, `FF D8 FF` → JPEG, `89 50 4E 47 0D 0A 1A 0A` → PNG, otro → `null`
(415 `TIPO_NO_PERMITIDO`, nada guardado). Límites: 1–10 archivos y ≤ 15 MB sumando `File.size`
**antes** de leer bytes (413 `CARGA_DEMASIADO_GRANDE`); `consumirLimite("firmados:<userId>", 20, 3600)`.
`unirEnPdf`: un PDF solo se guarda tal cual; imágenes (o mezcla) → PDF nuevo con una página A4
(595.28 × 841.89 pt) por imagen (`embedJpg`/`embedPng`, escalada con margen de 24 pt, centrada) y
las páginas de PDFs con `copyPages`, en el orden recibido. Se guarda como `documentos` `firmado`
de la versión actual y la transición `cargar_firma` va por `ejecutarTransicion`. `revisarFirma`:
aceptar → `aceptado` + `lista_para_enviar`; rechazar con motivo → `rechazado` + `motivo_rechazo` +
`pendiente_firma`; sin motivo → `MOTIVO_REQUERIDO`. En el detalle del cliente:
`<input type="file" multiple accept="image/*,application/pdf" capture="environment">`, lista con
tamaños y total, mensajes 413/415 en texto, y el aviso de secciones en blanco por diseño (PEP,
FATCA/CRS, moneda extranjera, origen de fondos, referencias, cónyuge, firmas y huellas). La prueba
genera PNG válidos con un codificador mínimo (`deflateSync` + `zlib.crc32` de `node:zlib`).

**Files**
- `src/server/firmas/**` — nuevo
- `src/app/api/v1/solicitudes/**` — nuevo `[id]/firmados/route.ts`
- `src/app/api/staff/solicitudes/**` — nuevo `[id]/firma/[accion]/route.ts`
- `src/components/cliente/**` — nuevo `carga-firmada.tsx`; edit del detalle (documentos de la versión actual)
- `tests/integration/firmas.test.ts` — nuevo

**Acceptance**

1. **WHEN** el cliente dueño sube 2 imágenes PNG a `POST /api/v1/solicitudes/{id}/firmados` en `pendiente_firma` **THE SYSTEM SHALL** guardar un único PDF de 2 páginas A4 como documento tipo `firmado` y pasar la solicitud a `firma_en_revision`.
2. **WHEN** un archivo no empieza por `%PDF-`, `FF D8 FF` ni la firma PNG, aunque declare un MIME permitido, **THE SYSTEM SHALL** responder 415 con código `TIPO_NO_PERMITIDO` y no guardar nada.
3. **WHEN** llegan más de 10 archivos o más de 15 MB en total **THE SYSTEM SHALL** responder 413 con código `CARGA_DEMASIADO_GRANDE`.
4. **WHEN** el asesor acepta el firmado **THE SYSTEM SHALL** marcarlo `aceptado` y pasar a `lista_para_enviar`; **WHEN** lo rechaza con motivo **THE SYSTEM SHALL** marcarlo `rechazado` con `motivo_rechazo` y volver a `pendiente_firma`.
5. **WHEN** el asesor rechaza sin motivo **THE SYSTEM SHALL** responder 422 con código `MOTIVO_REQUERIDO`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/firmas.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T6: carga firmada y revision"
git tag step-13-firmas
```

### `E2-T7` — Espacio de trabajo del asesor

**Depends on:** `E2-T6` · **Priority:** p0

`consultas.ts`: `bandeja` (primero `pendiente_validacion` y `firma_en_revision`, luego el resto,
por `updated_at`), `listado` (`q` con `ILIKE` sobre `codigo`, `clientes.nombre` y
`clientes.num_doc`; filtros `estado`, `entidad`, `asesor` (solo coordinador); siempre
`LIMIT/OFFSET` + `count(*)`; 25 por página), `detalleStaff` (eventos, versiones, documentos por
versión, `alertaVigencia` cuando la condición congelada tiene `vigente_hasta` < hoy en
`pendiente_firma`, `firma_en_revision` o `lista_para_enviar`). `edicion.ts`: sin motivo →
`MOTIVO_REQUERIDO`; en `borrador`/`devuelta`/`pendiente_validacion` edita sin cambiar estado; en
`pendiente_firma`, `firma_en_revision`, `lista_para_enviar` y `enviada_entidad` recalcula con la
tabla vigente hoy, `version_actual + 1`, nueva `solicitud_versiones`, PDFs nuevos, generados y
firmados anteriores → `desactualizado`, estado `pendiente_firma`; diffs `{ campo, antes, despues }`
en `metadata.cambios`. `reasignacion.ts`: `can("cliente.reasignar")`; actualiza
`clientes.asesor_id` y el `asesor_id` de sus solicitudes no finales. UI: bandeja, lista con
filtros en `searchParams`, detalle con acciones solo de la tabla de estados (aprobar, devolver,
cancelar, revisar firma, enviar a la entidad), edición con `DialogoMotivo`, notas, reasignación,
`/asesor/clientes` con invitación (`crearInvitacion`). `loading.tsx` y `error.tsx` en cada segmento;
tablas que bajo 768 px pasan a tarjetas.

**Files**
- `src/server/solicitudes/**` — nuevos `consultas.ts`, `edicion.ts`, `notas.ts`, `reasignacion.ts`
- `src/app/(staff)/asesor/**` — nuevo: `page.tsx`, `solicitudes/`, `solicitudes/[id]/` (+ `acciones.ts`), `clientes/` (+ `acciones.ts`)
- `src/components/staff/**` — nuevo: `tabla-paginada.tsx`, `linea-de-tiempo.tsx`, `insignia-estado.tsx`, `dialogo-motivo.tsx`
- `tests/integration/asesor.test.ts` — nuevo

**Acceptance**

1. **WHEN** un asesor abre la bandeja **THE SYSTEM SHALL** listar primero las solicitudes de sus clientes en `pendiente_validacion` y `firma_en_revision`, paginadas en el servidor de a 25.
2. **WHEN** el listado recibe `q` con un código, un nombre o un número de documento **THE SYSTEM SHALL** devolver solo las filas que coinciden, y con 60 solicitudes sembradas en la prueba SHALL devolver páginas de 25, 25 y 10 filas.
3. **WHEN** un asesor edita con motivo una solicitud en `firma_en_revision` **THE SYSTEM SHALL** crear `solicitud_versiones` número N+1, regenerar los PDF con versión N+1, marcar `desactualizado` el firmado anterior, pasar a `pendiente_firma` y guardar en `audit_events.metadata` los cambios con `campo`, `antes` y `despues`.
4. **WHEN** la edición llega sin motivo **THE SYSTEM SHALL** lanzar `MOTIVO_REQUERIDO` y no cambiar nada.
5. **WHEN** el coordinador reasigna un cliente a otro asesor **THE SYSTEM SHALL** actualizar `clientes.asesor_id` y el `asesor_id` de sus solicitudes no finales, y el asesor anterior SHALL recibir `NO_ENCONTRADO` al pedirlas; **WHEN** un asesor intenta reasignar **THE SYSTEM SHALL** lanzar `PROHIBIDO`.
6. **WHEN** la condición congelada de una solicitud en `pendiente_firma`, `firma_en_revision` o `lista_para_enviar` tiene `vigente_hasta` anterior a hoy **THE SYSTEM SHALL** devolver `alertaVigencia` en `true` en el detalle del asesor.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/asesor.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E2-T7: espacio de trabajo del asesor"
git tag step-14-asesor
```

---

## Epic acceptance

El epic está hecho cuando cada tarea está `done` **y**:

1. **WHEN** una solicitud recorre enviar → aprobar → cargar firma → aceptar firma → enviar a la entidad en las pruebas de integración **THE SYSTEM SHALL** dejar una fila de evento y una de auditoría por transición y documentos versionados con sha256 verificable.
2. **WHEN** cualquier cliente o asesor pide un recurso que no puede ver por `/api/v1` o por los servicios de staff **THE SYSTEM SHALL** responder `NO_ENCONTRADO` sin revelar su existencia.

```bash
docker compose up -d --wait postgres && pnpm db:test:prepare
pnpm typecheck && pnpm lint && pnpm test
pnpm e2e tests/e2e/asistente.spec.ts && pnpm e2e tests/e2e/responsive.spec.ts
```

## Pitfalls

- **`shadcn init` reescribe `globals.css`** — restaura con `git checkout -- src/app/globals.css` y añade solo la línea de `tw-animate-css`.
- **`#2F9E5B` como color de texto** — da 3,41:1; usa `success-strong` (`#1E7A45`).
- **Validar el tipo por MIME** — el navegador miente; valida por bytes iniciales.
- **Leer el multipart antes de sumar tamaños** — suma `File.size` primero.
- **Generar el golden en CI** — Vitest no escribe snapshots nuevos con `CI`; genéralos en local y commitea.
- **`Intl.NumberFormat` en el PDF** — usa `formatoMiles`; el golden no debe depender de ICU.
- **Actualizar `estado` con un `update` suelto** — siempre `ejecutarTransicion()` con evento y auditoría.
- **Paginar en el navegador** — `LIMIT/OFFSET` en SQL desde la primera lista.

## Before moving on

- [ ] Cada tarea de este epic está `done` en `tasks.json` — ninguna en `in_progress`.
- [ ] Pasaron todos los comandos `verify` de cada tarea, no solo el primero.
- [ ] No se editó ni se saltó ningún comando `verify`.
- [ ] **Cada tarea tiene su tag**: `git tag -l 'step-*'` incluye `step-08-diseno` … `step-14-asesor`.
- [ ] El gate pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Produced" existe con la firma indicada.
- [ ] No se modificó ningún archivo fuera del subárbol.
- [ ] `.env.example` no necesitó variables nuevas (las de almacenamiento ya estaban).
- [ ] Un commit por tarea, cada uno con el id de la tarea y seguido de su tag.
