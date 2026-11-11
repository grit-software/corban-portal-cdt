# Epic 03: Operación y lanzamiento

> Después de este epic los CDT constituidos llegan al portafolio del cliente, el coordinador importa cartera desde Excel, gerencia tiene reportes exportables, las transiciones notifican por correo, el portal es instalable como PWA, el admin gestiona el staff, los 4 flujos críticos tienen E2E y existe una imagen Docker probada con su CI y su lista de lanzamiento.

| | |
|---|---|
| **Epic id** | `03-operacion` |
| **Tasks** | `E3-T1` … `E3-T6` |
| **Depends on** | `01-fundaciones`, `02-solicitudes` |
| **Unlocks** | nada — es el último |
| **Parallel with** | ninguno (`E3-T2` y `E3-T3` dependen solo de `E3-T1` y no comparten archivos) |

No necesitas ningún otro archivo para completar este epic. Todo lo de abajo se repite aquí a propósito.
Contratos largos dentro del proyecto: `docs/referencia/contratos.md` (errores §1, permisos §2,
estados §3, catálogos y claves de perfil §6, límites §9, correos §10).

---

## Stack

Next.js 16 App Router (`output: "standalone"`, `src/`, `proxy.ts`) · TypeScript 6 · Tailwind v4 ·
shadcn/ui · PostgreSQL 17 · Drizzle ORM · better-auth · exceljs · recharts · Vitest + Playwright ·
Biome · Docker (`node:24.22.2-bookworm-slim`) · Azure App Service. Gestor: `pnpm` 12.16.1.
Runtime en `.nvmrc` (24). Versiones en `pnpm-lock.yaml`.

| Task | Command |
|---|---|
| Dev | `pnpm dev` |
| Typecheck | `pnpm typecheck` |
| Lint / formato | `pnpm lint` · `pnpm format` |
| Test (un archivo) | `pnpm test tests/integration/portafolio.test.ts` |
| E2E (un archivo) | `pnpm e2e tests/e2e/flujos.spec.ts` |
| Build + smoke | `pnpm build` · `sh scripts/smoke-standalone.sh <ruta> <texto> [código] [método]` |
| Docker | `docker build -t corban-cdt:local .` · `sh scripts/smoke-docker.sh` |
| Base de pruebas | `pnpm db:test:prepare` |
| Servicios locales | `docker compose up -d --wait postgres` / `pnpm services:down` |

**Gate:** `pnpm typecheck && pnpm lint && pnpm test` pasa antes de marcar cualquier tarea como hecha.

Las tareas con Postgres lo levantan en su `Verify`. `docker-compose.yml`, `playwright.config.ts`,
`tests/e2e/preparar.ts` y `.github/workflows/ci.yml` ya existen (workspace): no los reescribes.

## Directory subtree

```
src/
  app/(staff)/asesor/                    # existe (E2-T7) — E3-T1 añade el formulario de constitución
  app/(staff)/coordinador/importar/      # NUEVO (E3-T2)
  app/(staff)/gerencia/                  # NUEVO (E3-T3)
  app/(staff)/admin/                     # NUEVO (E3-T4)
  app/(cliente)/mi-cuenta/               # existe — E3-T1 añade portafolio/ y el resumen del inicio
  app/api/v1/                            # existe — E3-T1 añade portafolio/route.ts
  app/api/staff/importaciones/           # NUEVO (E3-T2)
  app/api/staff/reportes/                # NUEVO (E3-T3)
  app/manifest.ts                        # NUEVO (E3-T4)
  app/iconos/[tamano]/route.tsx          # NUEVO (E3-T4)
  components/staff/                      # existe — E3-T3 añade graficos/
  server/portafolio/                     # NUEVO (E3-T1)
  server/importacion/                    # NUEVO (E3-T2)
  server/reportes/                       # NUEVO (E3-T3)
  server/solicitudes/notificaciones.ts   # existe (stub de E2-T5) — E3-T4 lo reemplaza
next.config.ts                           # existe — E3-T5 añade cabeceras de seguridad
Dockerfile · .dockerignore               # NUEVOS (E3-T6)
scripts/smoke-docker.sh                  # NUEVO (E3-T6)
docs/lanzamiento.md                      # NUEVO (E3-T6)
tests/
  integration/{portafolio,importacion,reportes,notificaciones,endurecimiento}.test.ts  # NUEVOS
  e2e/flujos.spec.ts                     # NUEVO (E3-T5)
  e2e/{responsive.spec.ts,apoyo.ts}      # existen — E3-T5 los amplía
  unit/ci.test.ts                        # NUEVO (E3-T6)
```

Todo lo que está fuera de este árbol queda fuera de alcance.

## Data model touched here

| Entity | Fields this epic adds or reads | Notes |
|---|---|---|
| `cdts` | todos; `origen` solicitud/importacion; único (`entidad_id`, `numero_cdt`) | Vigente en lectura = `estado = 'vigente'` y `fecha_venc >= hoy` |
| `solicitudes` | `constituida_at`, `estado` `cdt_constituido` | Base del promedio de días |
| `import_perfiles`, `import_cargas` | todos | Contadores: creadas, actualizadas, sin cambios, rechazadas |
| `clientes` | upsert por (`tipo_doc`, `num_doc`), `perfil` fusionado | Precarga del asistente |
| `solicitud_eventos` | `notificado_at` | Nulo si el correo falló |
| `staff_members` | alta, rol, `activo` | Desactivar borra sesiones |

## Contracts

**Consumed** — ya existe, no lo reconstruyas:

| From | Interface | Guarantee |
|---|---|---|
| `01-fundaciones` | `can`, `ErrorDominio`, `respuestaError`, `conAuditoria`, `getActor`, `log` | — |
| `01-fundaciones` | `crearStaff`, `cambiarRolStaff`, `desactivarStaff` (`src/server/auth/staff.ts`) | Con `can("staff.administrar")` y auditoría |
| `01-fundaciones` | `consumirLimite`, `getMailDriver`, plantillas de correo | — |
| `02-solicitudes` | `ejecutarTransicion(actor, id, accion, entrada)` | Tabla de `contratos.md` §3, evento + auditoría |
| `02-solicitudes` | `notificarTransicion(evento)` (stub) | Se llama después del commit de cada transición |
| `02-solicitudes` | `crearBorrador`, `filtroVisibilidad`, `getStorage`, catálogos de `src/lib/datos/` | — |
| `02-solicitudes` | `TablaPaginada`, `LineaDeTiempo`, `InsigniaEstado`, `DialogoMotivo` | — |
| `02-solicitudes` | `tests/e2e/apoyo.ts` (`iniciarSesionStaff`, `leerOtp`, `registrarClienteYConsentir`) | — |

**Produced:**

| Export | Signature | Used by |
|---|---|---|
| `src/server/portafolio/` → `constituir`, `portafolioDe` | `(actor, id, datos)` · `(actor, clienteId?)` | UI de cliente y staff, reportes |
| `src/server/importacion/` → `vistaPrevia`, `confirmar` | `(actor, archivo, perfilId)` | `/coordinador/importar` |
| `src/server/reportes/` → `inversion`, `vencimientos`, `resumenSolicitudes`, `exportarXlsx` | `(actor, filtros)` | `/gerencia` |
| `GET /manifest.webmanifest`, `GET /iconos/{192,512}` | — | navegadores (PWA) |
| imagen `corban-cdt:local` | `node server.js` en el puerto 3000 | despliegue |

## Conventions that bite in this area

- **Constituir va por `ejecutarTransicion()`** con la acción `constituir`; la unicidad de `cdts`
  se traduce a `CONFLICTO` y revierte todo.
- **"Vigente" se calcula al leer** (`fecha_venc >= hoy` en America/Bogota): no hay trabajos programados.
- **Importación idempotente:** una fila es *actualizada* solo si cambió algún valor; si no, *sin cambios*.
  Bloques de 200 filas, una transacción por bloque.
- **Las notificaciones nunca lanzan:** fallo → `log.error` con el id del evento (sin correo ni
  documento) y `notificado_at` nulo.
- **E2E contra `next dev`** (puerto 3200, base de pruebas); el 404 de `/api/test/login` en
  producción se prueba con el smoke del build standalone.
- **`.dockerignore` antes de la primera `docker build`.** Las migraciones no van en la imagen.
- **Comandos `az` no son gates:** se documentan en `docs/lanzamiento.md` y los ejecuta una persona.
- Termina cada tarea con `pnpm format`.

Reglas del proyecto: `CLAUDE.md`. Reglas por área: `.claude/rules/server.md`, `api-v1.md`,
`ui.md`, `pruebas.md`.

---

## Tasks

En el mismo orden que `tasks.json`.

### `E3-T1` — Envío a la entidad, constitución y portafolio

**Depends on:** `E2-T7` · **Priority:** p0

`constituir(actor, id, { numeroCdt, valor, tasaEa, fechaApertura, fechaVenc })` vía
`ejecutarTransicion` (acción `constituir`, desde `enviada_entidad`): inserta `cdts` con `origen`
`solicitud`, la `periodicidad` congelada y `solicitud_id`, fija `constituida_at`; violación de
`cdts_entidad_numero_uq` → `CONFLICTO` (409) y rollback. `portafolioDe(actor, clienteId?)` con
`can("portafolio.ver")`: vigentes = `estado = 'vigente'` y `fecha_venc >= hoy`; `totalInvertido`
= suma de `valor`; `proximosVencimientos` ascendentes. En el detalle del asesor, cuando el estado
es `enviada_entidad`, el formulario «Registrar constitución» prellenado con los valores
congelados (editables) + server action. `/mi-cuenta/portafolio`: tarjetas de CDT vigentes, total,
próximos vencimientos, vacío «Aún no tienes CDT constituidos» con «Abrir un CDT»; el inicio
muestra el resumen. `GET /api/v1/portafolio`.

**Files**
- `src/server/portafolio/**` — nuevo: `constituir.ts`, `consultas.ts`
- `src/app/(staff)/asesor/**` — edit: formulario de constitución en `solicitudes/[id]` + acción
- `src/app/(cliente)/mi-cuenta/**` — nuevo `portafolio/page.tsx`; edit del inicio
- `src/app/api/v1/**` — nuevo `portafolio/route.ts`
- `tests/integration/portafolio.test.ts` — nuevo

**Acceptance**

Copiado del arreglo `acceptance` de `tasks.json` — idéntico tras la normalización de énfasis definida en `agents/blueprint-writer.md` *Acceptance strings*.

1. **WHEN** el asesor constituye una solicitud en `enviada_entidad` con `numero_cdt`, `valor`, `tasa_ea`, `fecha_apertura` y `fecha_venc` finales **THE SYSTEM SHALL** pasarla a `cdt_constituido`, fijar `constituida_at` y crear exactamente una fila en `cdts` con `origen` en `solicitud`.
2. **WHEN** se intenta constituir con un `numero_cdt` que ya existe para esa entidad **THE SYSTEM SHALL** responder `CONFLICTO` (409), dejar una sola fila en `cdts` y la solicitud en `enviada_entidad`.
3. **WHEN** el cliente dueño llama `GET /api/v1/portafolio` **THE SYSTEM SHALL** devolver sus CDT vigentes, `totalInvertido` igual a la suma de su `valor` y `proximosVencimientos` en orden ascendente de `fecha_venc`, sin CDT de otros clientes.
4. **WHEN** un CDT tiene `fecha_venc` anterior a hoy **THE SYSTEM SHALL** excluirlo de los vigentes del portafolio aunque su `estado` sea `vigente`.
5. **WHEN** se intenta cancelar una solicitud en `cdt_constituido` **THE SYSTEM SHALL** responder `TRANSICION_INVALIDA` (409).

**Verify** — cada comando, en orden, desde la raíz del proyecto.

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/portafolio.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E3-T1: envio, constitucion y portafolio"
git tag step-15-portafolio
```

### `E3-T2` — Importación desde Excel

**Depends on:** `E3-T1` · **Priority:** p1

Destinos de columna: `cliente.tipo_doc`, `cliente.num_doc`, `cliente.nombres`, `cliente.email`,
`cliente.celular`, `cliente.<clave de perfil de contratos.md §6>`, `cdt.entidad`, `cdt.numero_cdt`,
`cdt.valor`, `cdt.tasa_ea`, `cdt.fecha_apertura`, `cdt.fecha_venc`, `cdt.periodicidad`,
`cdt.estado`, `ignorar`. Lectura con exceljs (primera hoja, fila 1 = encabezados). Fechas
`dd/mm/yyyy`, `yyyy-mm-dd`, `Date` de exceljs o serial de Excel (días desde 1899-12-30) → ISO;
entidad por id o nombre sin tildes; valor a entero. Errores por fila: fecha inválida, entidad
desconocida, documento vacío. `vistaPrevia` → máx. 50 filas con errores. `confirmar` → bloques de
200 filas, una transacción por bloque, upsert de `clientes` por (`tipo_doc`, `num_doc`) fusionando
`perfil` y de `cdts` por (`entidad_id`, `numero_cdt`) con `origen` `importacion`; contadores
creadas / actualizadas (algún valor cambió) / sin cambios / rechazadas en `import_cargas`;
rechazos a un .xlsx (columnas originales + `motivo`) vía `getStorage()`; auditoría por bloque.
Todo con `can("importacion.ejecutar")`. UI: subir → mapear columnas (guardar perfil con nombre) →
vista previa → confirmar → resumen con enlace de rechazos. La prueba construye el .xlsx con
exceljs (incluye `31/02/2026`, entidad `Banco X`, documento vacío y una fecha serial).

**Files**
- `src/server/importacion/**` — nuevo: `catalogo.ts`, `leer.ts`, `normalizar.ts`, `perfiles.ts`, `importar.ts`
- `src/app/(staff)/coordinador/importar/**` — nuevo
- `src/app/api/staff/importaciones/**` — nuevo: `vista-previa`, `confirmar`, `[cargaId]/rechazos`
- `tests/integration/importacion.test.ts` — nuevo

**Acceptance**

1. **WHEN** se previsualiza un .xlsx con un perfil de mapeo guardado **THE SYSTEM SHALL** devolver como máximo 50 filas, cada una con sus errores: fecha inválida (se aceptan dd/mm/yyyy, yyyy-mm-dd y serial de Excel), entidad desconocida y documento vacío.
2. **WHEN** se confirma la importación **THE SYSTEM SHALL** hacer upsert de `clientes` por (`tipo_doc`, `num_doc`) y de `cdts` por (`entidad_id`, `numero_cdt`) en una transacción por bloque de 200 filas y escribir una fila en `import_cargas` con creadas, actualizadas, sin cambios y rechazadas.
3. **WHEN** el mismo archivo se importa por segunda vez **THE SYSTEM SHALL** reportar 0 creadas y 0 actualizadas y no cambiar ningún valor en `clientes` ni en `cdts`.
4. **WHEN** hay filas rechazadas **THE SYSTEM SHALL** guardar un .xlsx de rechazos con las columnas originales más la columna `motivo` y permitir descargarlo.
5. **WHEN** un cliente importado inicia una nueva solicitud **THE SYSTEM SHALL** precargar `datos` con las claves de `clientes.perfil` que trajo la importación.
6. **WHEN** un asesor llama las rutas de importación **THE SYSTEM SHALL** responder 403 con código `PROHIBIDO`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/importacion.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E3-T2: importacion desde excel"
git tag step-16-importacion
```

### `E3-T3` — Reportes de gerencia y exportación

**Depends on:** `E3-T1` · **Priority:** p1

`inversion` (suma de `valor` de CDT vigentes por entidad y por asesor del cliente),
`vencimientos(dias)` (30, 60 o 90: vigentes con `fecha_venc` entre hoy y hoy + días,
ascendente), `resumenSolicitudes` (conteo por estado y promedio de días entre `created_at` y
`constituida_at`); filtros `desde`, `hasta`, `entidadId`, `asesorId`; `can("reportes.ver")`
(coordinador y gerencia). `exportarXlsx` con encabezados en español (Entidad, Asesor, Total
invertido (COP); Cliente, Entidad, Número CDT, Valor (COP), Vencimiento; Estado, Cantidad,
Promedio de días). Ruta `GET /api/staff/reportes/{reporte}/xlsx` (`inversion`, `vencimientos`,
`solicitudes`) con `content-type` de hoja de cálculo. `/gerencia` con filtros en `searchParams`,
tablas y gráficos recharts (`"use client"`, colores de tokens, tabla equivalente debajo).

**Files**
- `src/server/reportes/**` — nuevo
- `src/app/(staff)/gerencia/**` — nuevo: `page.tsx`, `loading.tsx`, `error.tsx`
- `src/app/api/staff/reportes/**` — nuevo `[reporte]/xlsx/route.ts`
- `src/components/staff/**` — nuevo `graficos/barras-inversion.tsx`, `graficos/barras-estados.tsx`
- `tests/integration/reportes.test.ts` — nuevo

**Acceptance**

1. **WHEN** se calcula el reporte de inversión **THE SYSTEM SHALL** devolver el total por entidad y por asesor igual a la suma SQL de `valor` de los `cdts` vigentes sembrados en la prueba.
2. **WHEN** se calcula el reporte de vencimientos a 30, 60 y 90 días **THE SYSTEM SHALL** listar solo CDT vigentes con `fecha_venc` dentro de cada ventana, en orden ascendente.
3. **WHEN** se calcula el resumen de solicitudes **THE SYSTEM SHALL** devolver el conteo por estado y el promedio de días entre `created_at` y `constituida_at` de las constituidas, respetando los filtros de fechas, entidad y asesor.
4. **WHEN** se pide `GET /api/staff/reportes/{reporte}/xlsx` **THE SYSTEM SHALL** responder un .xlsx cuya primera hoja, releída con exceljs, tiene la fila de encabezados y las filas de datos del reporte.
5. **WHEN** un cliente o un asesor pide un reporte **THE SYSTEM SHALL** responder 403 con código `PROHIBIDO`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/reportes.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

**Checkpoint**

```bash
git add -A && git commit -m "E3-T3: reportes de gerencia"
git tag step-17-reportes
```

### `E3-T4` — Notificaciones, PWA y administración del staff

**Depends on:** `E3-T3` · **Priority:** p1

`notificarTransicion(evento)` reemplaza el stub: `pendiente_validacion` → asesor asignado o, si
no hay, todos los coordinadores activos; `devuelta`, `pendiente_firma` y `cdt_constituido` →
cliente; `firma_en_revision` → asesor; plantillas de `contratos.md` §10 con el código de la
solicitud y un enlace absoluto (`BETTER_AUTH_URL` + ruta del detalle); fija `notificado_at`; si
falla, `log.error` con el id del evento y `notificado_at` nulo; nunca lanza. `/admin/staff`: tabla,
crear (correo, nombre, rol), cambiar rol, desactivar con confirmación que nombra a la persona;
server actions → `crearStaff`/`cambiarRolStaff`/`desactivarStaff`. `manifest.ts`:
`name` "Corban CDT", `short_name` "Corban CDT", `start_url` "/mi-cuenta", `display` "standalone",
`background_color` "#F5F6F7", `theme_color` "#1D2226", `lang` "es-CO", íconos `/iconos/192` y
`/iconos/512` (`image/png`, `purpose` "any"). `iconos/[tamano]/route.tsx`: `ImageResponse` de
`next/og`, cuadrado navy `#1D2226` de 192 o 512 px (otro → 404) con `public/logo.png` centrado al
60 % del ancho como `data:image/png;base64`. La prueba importa `manifest()` de `@/app/manifest`
y comprueba sus campos.

**Files**
- `src/server/solicitudes/notificaciones.ts` — edit: reemplaza el stub
- `src/app/(staff)/admin/**` — nuevo: `staff/page.tsx`, `staff/acciones.ts`
- `src/app/manifest.ts` — nuevo
- `src/app/iconos/[tamano]/route.tsx` — nuevo
- `tests/integration/notificaciones.test.ts` — nuevo

**Acceptance**

1. **WHEN** una solicitud pasa a `pendiente_validacion` **THE SYSTEM SHALL** enviar un correo al asesor asignado, o a los coordinadores si no tiene, y **WHEN** pasa a `pendiente_firma` o `devuelta` **THE SYSTEM SHALL** enviar un correo al cliente, cada uno con el código de la solicitud y un enlace a su detalle.
2. **WHEN** el envío de un correo falla **THE SYSTEM SHALL** conservar la transición, registrar el error en el log sin datos personales y dejar `solicitud_eventos.notificado_at` en nulo.
3. **WHEN** `manifest()` se evalúa **THE SYSTEM SHALL** devolver `name` Corban CDT, `start_url` /mi-cuenta, `display` standalone e íconos de 192 y 512 px, y **WHEN** el servidor standalone recibe `GET /manifest.webmanifest` **THE SYSTEM SHALL** responder 200 con ese `start_url` en el cuerpo.
4. **WHEN** el servidor standalone recibe `GET /iconos/192` o `GET /iconos/512` **THE SYSTEM SHALL** responder 200 con una imagen PNG.
5. **WHEN** un admin crea, cambia de rol o desactiva un miembro del staff desde `/admin/staff` **THE SYSTEM SHALL** escribir la fila y un `audit_events`; **WHEN** lo intenta un coordinador **THE SYSTEM SHALL** lanzar `PROHIBIDO`.

**Verify**

```bash
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test tests/integration/notificaciones.test.ts
pnpm typecheck
pnpm lint
pnpm build
sh scripts/smoke-standalone.sh /manifest.webmanifest /mi-cuenta
sh scripts/smoke-standalone.sh /iconos/192 PNG
sh scripts/smoke-standalone.sh /iconos/512 PNG
```

**Checkpoint**

```bash
git add -A && git commit -m "E3-T4: notificaciones, pwa y administracion del staff"
git tag step-18-notificaciones
```

### `E3-T5` — Endurecimiento y E2E de los 4 flujos

**Depends on:** `E3-T2`, `E3-T4` · **Priority:** p0

`next.config.ts` añade `async headers()` para `source: "/(.*)"`: `Content-Security-Policy` =
`default-src 'self'; script-src 'self' 'unsafe-inline'` (+ ` 'unsafe-eval'` solo si
`NODE_ENV === "development"`) `; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`;
`Strict-Transport-Security: max-age=63072000; includeSubDomains`; `X-Content-Type-Options: nosniff`;
`Referrer-Policy: strict-origin-when-cross-origin`; `X-Frame-Options: DENY`;
`Permissions-Policy: camera=(self), microphone=(), geolocation=()`. `flujos.spec.ts`, un `test()`
por flujo con datos propios: (1) registro por OTP (código de `.data/e2e-mail`), consentimiento,
asistente y envío → «Pendiente de validación»; (2) `asesor.e2e@corbanfc.com` por `/api/test/login`
aprueba → el cliente descarga cada formato (`page.waitForEvent("download")`, bytes `%PDF-`);
(3) el cliente sube 2 PNG generados en la prueba → el asesor acepta, marca enviada y constituye →
el CDT aparece en `/mi-cuenta/portafolio` con su número; (4) el asesor edita con motivo una
solicitud en `firma_en_revision` → versión 2, el firmado anterior «Desactualizado», estado
«Pendiente de firma». Barrido responsive de todas las páginas principales (las de E2-T3 más
`/mi-cuenta/portafolio`, `/mi-cuenta/solicitudes/<id>`, `/asesor`, `/asesor/solicitudes`,
`/asesor/solicitudes/<id>`, `/asesor/clientes`, `/coordinador/importar`, `/gerencia`,
`/admin/staff`, cada una con el rol que la ve). `endurecimiento.test.ts`: importa `next.config.ts`
y comprueba las 6 cabeceras; 11 registros desde la misma IP → el 11.º 429; ningún `console.log` en
`src/` (lectura con `node:fs`, sin `src/components/ui`).

**Files**
- `next.config.ts` — edit: `headers()`
- `tests/e2e/flujos.spec.ts` — nuevo
- `tests/e2e/responsive.spec.ts` — edit: barrido completo
- `tests/e2e/apoyo.ts` — edit: `crearSolicitudCompleta`, `aprobarComoAsesor`, `pngDePrueba`, `iniciarSesionComo`
- `tests/integration/endurecimiento.test.ts` — nuevo

**Acceptance**

1. **WHEN** `pnpm e2e tests/e2e/flujos.spec.ts` se ejecuta **THE SYSTEM SHALL** pasar los 4 flujos: registro por OTP con consentimiento y envío; aprobación por el asesor con PDFs descargables por el cliente; carga de fotos firmadas, aceptación, envío y constitución visible en el portafolio; edición posterior a la aprobación que crea la versión 2, desactualiza el firmado y vuelve a `pendiente_firma`.
2. **WHEN** el servidor standalone de producción recibe `POST /api/test/login` **THE SYSTEM SHALL** responder 404 aunque `AUTH_TEST_LOGIN` valga 1.
3. **WHEN** se lee la configuración de `next.config.ts` **THE SYSTEM SHALL** declarar para todas las rutas `Content-Security-Policy` con `frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options` en `nosniff`, `Referrer-Policy` en `strict-origin-when-cross-origin`, `X-Frame-Options` en `DENY` y `Permissions-Policy`.
4. **WHEN** `pnpm e2e tests/e2e/responsive.spec.ts` se ejecuta **THE SYSTEM SHALL** no reportar desbordamiento horizontal en ninguna página principal de cliente y de staff a 375, 768 y 1440 px.
5. **WHEN** `POST /api/v1/auth/registro` se llama 11 veces desde la misma IP en 15 minutos **THE SYSTEM SHALL** responder 429 con código `LIMITE_EXCEDIDO` en la undécima.

**Verify**

```bash
pnpm exec playwright install chromium
docker compose up -d --wait postgres
pnpm db:test:prepare
pnpm test
pnpm test tests/integration/endurecimiento.test.ts
pnpm e2e tests/e2e/flujos.spec.ts
pnpm e2e tests/e2e/responsive.spec.ts
pnpm build
sh scripts/smoke-standalone.sh /api/test/login NO_ENCONTRADO 404 POST
status=0; grep -rnE '\.(skip|only)\(' tests || status=$?; test "$status" -eq 1
pnpm typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E3-T5: endurecimiento y e2e de los 4 flujos"
git tag step-19-endurecimiento
```

### `E3-T6` — Contenedor, CI y lista de lanzamiento

**Depends on:** `E3-T5` · **Priority:** p1

Escribe `.dockerignore` **antes** de la primera `docker build`, con estas líneas exactas:
`.git`, `.next`, `node_modules`, `.data`, `.env`, `.env.*`, `blueprints`, `.claude`, `docs`,
`tests`, `coverage`, `playwright-report`, `test-results`. El `Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24.22.2-bookworm-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24.22.2-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nextjs && useradd --system --uid 1001 --gid nextjs nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
COPY --from=build --chown=nextjs:nextjs /app/assets ./assets
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

`scripts/smoke-docker.sh`:

```sh
#!/bin/sh
# Arranca corban-cdt:local en el puerto 3300, pide /api/health y detiene el contenedor.
set -eu
nombre=corban-cdt-smoke
docker rm -f "$nombre" >/dev/null 2>&1 || true
docker run -d --rm --name "$nombre" -p 3300:3000 corban-cdt:local >/dev/null
trap 'docker stop "$nombre" >/dev/null 2>&1 || true' EXIT
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS http://127.0.0.1:3300/api/health | grep -q '"status":"ok"'; then
    echo "ok: el contenedor responde /api/health"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done
docker logs "$nombre" >&2 || true
exit 1
```

`docs/lanzamiento.md` (en español) contiene: la lista de verificación de lanzamiento (revisión
visual de los 6 PDF por un asesor senior; ingreso real con Entra de un staff y rechazo de un no
registrado; driver `azure` real con SAS de 5 min y contenedor sin acceso anónimo; correo real por
ACS sin spam; revisión legal del consentimiento `2026-11-v1`, retención y transferencia
internacional; Application Insights con un error de prueba y alerta de `/api/health/db`;
migraciones con `pnpm db:migrate` como paso de release, `pnpm db:seed` con el admin real y
condiciones reales cargadas; rollback practicado; pasadas de teclado, lector de pantalla y zoom;
`AUTH_TEST_LOGIN=0`), el procedimiento de release (construir y publicar la imagen; migrar; cambiar
la imagen con `az webapp config container set`; rollback a la etiqueta anterior) y este bloque de
aprovisionamiento, tal cual (verificar flags con `az <comando> --help`):

```bash
export GRUPO=rg-corban-cdt UBICACION=eastus2
export PG=psql-corban-cdt ST=stcorbancdt ACS=acs-corban-cdt PLAN=asp-corban-cdt APP=app-corban-cdt
export IMAGEN="ghcr.io/corbanfc/corban-cdt:$(git rev-parse --short HEAD)"   # ajustar a la organización real de GitHub
az group create --name "$GRUPO" --location "$UBICACION"
az postgres flexible-server create --resource-group "$GRUPO" --name "$PG" --location "$UBICACION" \
  --tier Burstable --sku-name Standard_B1ms --storage-size 32 --version 17 \
  --admin-user corbanadmin --admin-password "$PG_ADMIN_PASSWORD" --public-access 0.0.0.0
az postgres flexible-server db create --resource-group "$GRUPO" --server-name "$PG" --database-name corban
az storage account create --name "$ST" --resource-group "$GRUPO" --location "$UBICACION" \
  --sku Standard_LRS --kind StorageV2 --min-tls-version TLS1_2 --allow-blob-public-access false
az storage container create --account-name "$ST" --name documentos --auth-mode login
az communication create --name "$ACS" --resource-group "$GRUPO" --location global --data-location UnitedStates
az appservice plan create --name "$PLAN" --resource-group "$GRUPO" --is-linux --sku B1
az webapp create --name "$APP" --resource-group "$GRUPO" --plan "$PLAN" --container-image-name "$IMAGEN"
az webapp identity assign --name "$APP" --resource-group "$GRUPO"
az role assignment create \
  --assignee "$(az webapp identity show --name "$APP" --resource-group "$GRUPO" --query principalId -o tsv)" \
  --role "Storage Blob Data Contributor" \
  --scope "$(az storage account show --name "$ST" --resource-group "$GRUPO" --query id -o tsv)"
az webapp config appsettings set --name "$APP" --resource-group "$GRUPO" --settings \
  NODE_ENV=production WEBSITES_PORT=3000 AUTH_TEST_LOGIN=0 \
  BETTER_AUTH_URL="https://$APP.azurewebsites.net" \
  STORAGE_DRIVER=azure AZURE_STORAGE_ACCOUNT="$ST" AZURE_STORAGE_CONTAINER=documentos \
  MAIL_DRIVER=acs MAIL_FROM="$MAIL_FROM" ADMIN_EMAIL="$ADMIN_EMAIL" \
  DATABASE_URL="$DATABASE_URL" BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
  ACS_CONNECTION_STRING="$ACS_CONNECTION_STRING" \
  ENTRA_CLIENT_ID="$ENTRA_CLIENT_ID" ENTRA_CLIENT_SECRET="$ENTRA_CLIENT_SECRET" ENTRA_TENANT_ID="$ENTRA_TENANT_ID"
az webapp config set --name "$APP" --resource-group "$GRUPO" --generic-configurations '{"healthCheckPath": "/api/health/db"}'
az ad app create --display-name "Corban CDT" --sign-in-audience AzureADMyOrg \
  --web-redirect-uris "https://$APP.azurewebsites.net/api/auth/callback/microsoft"
```

`tests/unit/ci.test.ts` lee con `node:fs` y comprueba: `ci.yml` contiene
`pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm db:test:prepare`,
`pnpm test`, `pnpm build`, `pnpm e2e` y `postgres:17-alpine`; `.dockerignore` tiene las líneas
`blueprints`, `.env`, `.data`, `node_modules` y `.next`; `Dockerfile` contiene
`node:24.22.2-bookworm-slim` y `USER nextjs`; `docs/lanzamiento.md` contiene
`az postgres flexible-server create` y `pnpm db:migrate`. `.github/workflows/ci.yml` ya existe:
no lo reescribas.

**Files**
- `Dockerfile` — nuevo
- `.dockerignore` — nuevo
- `scripts/smoke-docker.sh` — nuevo
- `docs/lanzamiento.md` — nuevo
- `tests/unit/ci.test.ts` — nuevo

**Acceptance**

1. **WHEN** `docker build -t corban-cdt:local .` se ejecuta **THE SYSTEM SHALL** terminar con código 0 usando la imagen base `node:24.22.2-bookworm-slim` y un usuario no root.
2. **WHEN** `sh scripts/smoke-docker.sh` arranca la imagen en el puerto 3300 **THE SYSTEM SHALL** responder `GET /api/health` con 200 y `status` en `ok`, y detener el contenedor.
3. **WHEN** `pnpm test tests/unit/ci.test.ts` se ejecuta **THE SYSTEM SHALL** confirmar que `.github/workflows/ci.yml` ejecuta `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm db:test:prepare`, `pnpm test`, `pnpm build` y `pnpm e2e` con un servicio `postgres:17-alpine`.
4. **WHEN** `pnpm test tests/unit/ci.test.ts` lee `.dockerignore` **THE SYSTEM SHALL** encontrar las exclusiones `blueprints`, `.env`, `.data`, `node_modules` y `.next`.
5. **WHEN** `pnpm test tests/unit/ci.test.ts` lee `docs/lanzamiento.md` **THE SYSTEM SHALL** encontrar el comando `az postgres flexible-server create` y el paso de release `pnpm db:migrate`.

**Verify**

```bash
pnpm test tests/unit/ci.test.ts
docker build -t corban-cdt:local .
sh scripts/smoke-docker.sh
pnpm typecheck
pnpm lint
```

**Checkpoint**

```bash
git add -A && git commit -m "E3-T6: contenedor, ci y lista de lanzamiento"
git tag step-20-contenedor-ci
git ls-files --error-unmatch Dockerfile .dockerignore docs/lanzamiento.md
```

---

## Epic acceptance

El epic está hecho cuando cada tarea está `done` **y**:

1. **WHEN** el gate global corre en un checkout limpio **THE SYSTEM SHALL** terminar con código 0 en biome ci, typecheck, migraciones, pruebas, build, smoke standalone, 404 del test-login en producción, E2E, build de Docker y smoke del contenedor.
2. **WHEN** el envío de un correo o un servicio externo falla durante una transición **THE SYSTEM SHALL** conservar la transición y su auditoría y registrar el fallo sin datos personales.

```bash
pnpm install --frozen-lockfile && pnpm exec biome ci . && pnpm typecheck
docker compose up -d --wait postgres && pnpm db:migrate && pnpm db:test:prepare && pnpm test
pnpm build && sh scripts/smoke-standalone.sh /api/health '"status":"ok"'
sh scripts/smoke-standalone.sh /api/test/login NO_ENCONTRADO 404 POST
pnpm e2e && docker build -t corban-cdt:local . && sh scripts/smoke-docker.sh
```

## Pitfalls

- **Marcar "vencido" con un trabajo programado** — no hay workers; "vigente" se decide al leer.
- **Contar como "actualizada" una fila idéntica** — rompe la idempotencia de la reimportación.
- **Lanzar desde `notificarTransicion`** — un correo caído no puede revertir una aprobación.
- **E2E contra la build de producción** — el test-login responde 404 ahí, por diseño.
- **CSP sin `'unsafe-eval'` en desarrollo** — React en modo dev lo necesita; solo en `development`.
- **Olvidar `assets/` en la imagen** — el motor PDF lee `process.cwd()/assets/formatos`.
- **Hornear secretos o migraciones en la imagen** — secretos en App Settings; migraciones como paso de release.

## Before moving on

- [ ] Cada tarea de este epic está `done` en `tasks.json` — ninguna en `in_progress`.
- [ ] Pasaron todos los comandos `verify` de cada tarea, no solo el primero.
- [ ] No se editó ni se saltó ningún comando `verify`.
- [ ] **Cada tarea tiene su tag**: `git tag -l 'step-*'` lista los 20 tags, de `step-01-andamiaje` a `step-20-contenedor-ci`.
- [ ] El gate global pasa limpio desde la raíz del proyecto.
- [ ] Cada contrato "Produced" existe con la firma indicada.
- [ ] No se modificó ningún archivo fuera del subárbol.
- [ ] `.env.example` no necesitó variables nuevas en este epic.
- [ ] Un commit por tarea, cada uno con el id de la tarea y seguido de su tag.
