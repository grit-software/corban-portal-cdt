# Corban FC — Portal de CDT — Blueprint

> Generado por The Architect el 2026-11-03
> Shape: saas-webapp (portal de clientes) con área interna de back-office (patrones de internal-tool) · `knowledge/shapes/saas-webapp.md` + `knowledge/shapes/internal-tool.md`
> Runtime track: ts-node · `knowledge/runtime-tracks/ts-node.md`
> Modo de emisión: bundle (`./blueprints/corban-portal-cdt/`)
> Versión del blueprint: 1
> Versiones verificadas por última vez: 2026-11-03 — ver §11 para la procedencia de cada paquete

**Cómo leer este bundle.** `blueprint.md` explica el porqué. `epics/*.md` explican el cómo, y cada
uno se ejecuta sin abrir este archivo. `tasks.json` decide qué sigue. `workspace/` se copia **una
sola vez, sin sobrescribir**, a la raíz del proyecto antes del paso 1 (§10, Bootstrap): trae la
configuración de agentes y todos los archivos que los `Verify` necesitan para ejecutarse.

---

## 1. Project Overview & Non-Goals

### Vision

Corban FC es una firma colombiana de asesoría financiera que hoy diligencia a mano —o con un
prototipo estático en el navegador— los formatos de vinculación y de apertura de CDT de cuatro
entidades (Ban100, Coltefinanciera, Juriscoop y Mundo Mujer). El mismo cliente escribe sus datos
una y otra vez, el asesor los transcribe a seis PDF distintos y el seguimiento vive en correos y
hojas de cálculo. El **Portal de CDT** es una sola aplicación web donde el cliente se registra (o es
invitado por su asesor), acepta el tratamiento de datos de la Ley 1581, escribe **una sola vez** sus
datos personales, laborales y financieros y su solicitud de CDT, y la sigue hasta que el CDT queda
constituido y aparece en su portafolio.

Del otro lado, el asesor valida, corrige (siempre con motivo), aprueba y mueve cada solicitud por un
flujo de estados explícito; al aprobar, el sistema **congela** la tasa y la fecha de vencimiento
calculadas desde una tabla de condiciones que administra el coordinador, y genera los formatos
oficiales de la entidad ya diligenciados sobre sus AcroForms reales. El cliente los descarga, los
firma en papel y sube el PDF o fotos del celular, que el servidor une en un solo PDF. El
coordinador ve todo, reasigna clientes y administra tasas, plazos y festivos; gerencia ve reportes;
el administrador gestiona el staff. Es una etapa piloto: menos de 20 personas de staff y unos
cientos de solicitudes al mes.

### Users

| Persona | Qué viene a hacer | Frecuencia |
|---|---|---|
| Cliente (inversionista persona natural) | Registrarse u aceptar una invitación, consentir Ley 1581, diligenciar su solicitud, descargar y subir formatos firmados, ver su portafolio | Por solicitud (pocas veces al año); consulta de portafolio mensual |
| Asesor | Validar, editar con motivo, aprobar o devolver, revisar firmas, registrar envío y constitución | Diario |
| Coordinador | Todo lo del asesor sobre todos los clientes, reasignar, administrar condiciones de tasa y festivos, importar Excel | Diario |
| Gerencia | Reportes de inversión, vencimientos y tiempos del flujo | Semanal |
| Administrador | Alta, cambio de rol y baja del staff | Ocasional |

### Goals — v1 scope

1. Un cliente se registra con OTP por correo (o acepta una invitación), consiente la Ley 1581 y
   diligencia una solicitud de CDT en un asistente mobile-first con autoguardado por paso.
2. La tasa E.A., la fecha de vencimiento y el valor en letras se **calculan** desde la tabla de
   condiciones (entidad, plazo, monto, periodicidad, vigencia, festivos) y se congelan al aprobar;
   nadie los digita.
3. Al aprobar, el sistema genera los PDF oficiales de la entidad (6 formatos, 4 entidades) con un
   motor probado contra snapshots golden, y los versiona en almacenamiento privado.
4. El cliente sube su firma como PDF o fotos (unidas en un PDF); el asesor la acepta o rechaza y
   registra el envío a la entidad y la constitución del CDT, que pasa al portafolio del cliente.
5. El staff trabaja en una bandeja paginada en servidor, con línea de tiempo, versiones,
   documentos, edición con motivo (nueva versión) y reasignación; toda acción queda en una
   auditoría de solo inserción.
6. El coordinador importa clientes y portafolio desde Excel con perfiles de mapeo, vista previa,
   errores por fila y reimportación idempotente; gerencia ve reportes exportables a .xlsx.
7. La API `/api/v1/**` del cliente es versionada, validada con zod y con errores tipados: es el
   contrato de la futura app móvil.

### Non-Goals — explicitly out of scope for v1

| No se construye | Por qué no ahora | Se revisa cuando |
|---|---|---|
| Renovación de CDT | Etapa 2; el OTP y el portafolio de v1 son su base, pero el flujo de renovación (aviso, nueva tasa, nuevo formato) no está especificado | El piloto tenga 3 meses de vencimientos reales en `cdts` |
| Envío automático a las entidades (correo o API) | Ninguna entidad expone API acordada; el envío es manual y se registra (`enviada_entidad`) | Una entidad entregue un canal técnico documentado |
| Firma electrónica | Requiere proveedor certificado y aceptación de cada entidad | Las 4 entidades acepten firma electrónica por escrito |
| Varios titulares por CDT | Cambia el modelo de datos y los 6 mapeos de PDF | Más del 10 % de solicitudes del piloto lo pidan |
| Integraciones con sistemas de las entidades | Sin contrato técnico con ninguna | Igual que el envío automático |
| Editor de marca / temas | La paleta vive en un solo archivo (`src/app/globals.css`) | El cliente entregue su manual de marca y pida cambios frecuentes |
| App móvil nativa, notificaciones push, modo offline | La web mobile-first + manifiesto PWA cubre el piloto; la API v1 ya es el contrato | El 50 % de las sesiones de cliente sean móviles recurrentes |
| Secciones PEP, FATCA/CRS, moneda extranjera, origen de fondos, referencias y cónyuge de los PDF | Quedan en blanco por diseño, como en el POC; el cliente las diligencia y firma a mano | Una entidad rechace formatos por estas secciones |
| Modo oscuro | v1 es solo modo claro | El cliente entregue la paleta oficial con variante oscura |

**El constructor no implementa nada de esta tabla**, aunque parezca una adición pequeña junto a un
paso vecino. Si un paso parece necesitar un no-objetivo, es un defecto del blueprint: detente y
repórtalo en vez de ampliar el alcance.

### Success metrics

| Métrica | Meta | Cómo se mide |
|---|---|---|
| Tiempo de diligenciamiento del cliente | Mediana < 20 min desde `created_at` hasta `pendiente_validacion`, al cierre del primer mes de piloto | `solicitud_eventos`: diferencia entre la creación y el evento `hacia = 'pendiente_validacion'` |
| Formatos rechazados por la entidad por datos mal ubicados | 0 en el primer mes | Conteo de `cancelada` con `motivo_cancelacion` que mencione rechazo de formato + revisión visual de lanzamiento (§20.1) |
| Días de creación a CDT constituido | Promedio < 7 días al tercer mes | Reporte "Resumen de solicitudes" (paso 17): promedio `constituida_at − created_at` |
| Solicitudes devueltas por datos incompletos | < 15 % al tercer mes | `count(eventos hacia 'devuelta') / count(eventos hacia 'pendiente_validacion')` |
| Clientes con portafolio consultable | 100 % de CDT constituidos en v1 y los importados del Excel inicial | `cdts` con `origen` en (`solicitud`, `importacion`) vs. inventario entregado por Corban |

---

## 2. Tech Stack

**Runtime track: ts-node.** Esta tabla nombra *decisiones*, no versiones. Cada versión vive en §11
y solo allí. Las versiones vienen del informe `stack-researcher` de esta sesión (2026-11-03); el
runtime track es solo el respaldo y no se usó para ningún pin.

| Capa | Decisión | Por qué esta, sobre cuál |
|---|---|---|
| Lenguaje / runtime | TypeScript 6.0 sobre Node 24 LTS | Un solo lenguaje en UI, API, scripts y pruebas. TypeScript 7 (Go) descartado: sin API de compilador estable para el tooling. Node 26 descartado: Azure App Service va más lento en adoptar la línea nueva y 24 está en mantenimiento LTS hasta 2028 |
| Framework | Next.js App Router, `output: "standalone"`, `src/`, `proxy.ts` | Portal público, área de cliente y back-office en un solo desplegable; standalone produce un `server.js` que corre en un contenedor de App Service sin Vercel |
| Estilos | Tailwind CSS v4 con `@theme` en `src/app/globals.css`, vía `@tailwindcss/postcss` | Un solo archivo de tokens para cuando llegue la paleta oficial. PostCSS en vez del loader de Turbopack porque funciona igual en `next build` y en el respaldo `--webpack` (el loader de Turbopack no hace nada bajo webpack, verificado en el track) |
| Componentes | shadcn/ui sobre Radix (copiados al repo con el CLI) | Tablas, diálogos, selects y pestañas accesibles listos para un back-office denso; se copian, no son dependencia opaca |
| Base de datos | PostgreSQL 17 (Azure Database for PostgreSQL Flexible Server en producción, `postgres:17-alpine` en local) | Datos relacionales con FKs, unicidades de negocio (`tipo_doc`+`num_doc`, `entidad`+`numero_cdt`), `jsonb` para el perfil y triggers para la auditoría inmutable |
| ORM / acceso a datos | Drizzle ORM + drizzle-kit, driver `postgres` (porsager) | Esquema en TypeScript como fuente de verdad, migraciones SQL commiteadas y legibles; más liviano que Prisma y sin cliente generado |
| Auth | better-auth con adaptador Drizzle: Microsoft Entra ID para el staff (tenant de Corban + lista `staff_members`), OTP por correo para clientes | Usuarios y sesiones en nuestra propia base (datos que no salen de Azure), sin costo por usuario; un solo dueño de la sesión para staff y clientes |
| Trabajo en segundo plano | Ninguno en v1: las notificaciones se envían al cerrar la transición, fuera de la transacción | Cientos de solicitudes al mes no justifican una cola; un fallo de correo no revierte la transición y queda `notificado_at` nulo |
| Pagos | NOT APPLICABLE — Corban no cobra en la plataforma; el dinero va del cliente a la entidad | — |
| Almacenamiento de archivos | Interfaz `StorageDriver` con drivers `fs` (local/pruebas, `.data/storage`) y `azure` (Blob privado, SAS de lectura de 5 min) | Los PDF con datos personales nunca son públicos; el driver `fs` hace que las pruebas corran sin Azure |
| Correo / notificaciones | Interfaz `MailDriver` con drivers `file` (JSON en `.data/mail`, lo leen las pruebas), `smtp` (nodemailer → Mailpit opcional) y `acs` (Azure Communication Services) | OTP e invitaciones verificables en pruebas sin red; ACS en producción dentro de la misma suscripción de Azure |
| Hosting | Azure App Service Linux (contenedor) + Azure PostgreSQL Flexible + Storage Account + Communication Services + Entra ID | El staff de Corban ya vive en Microsoft 365; un solo proveedor, una sola factura y Entra nativo |
| Gestor de paquetes | pnpm 12 (vía corepack) | `node_modules` estricto que atrapa dependencias fantasma; `packageManager` fija la versión en local, CI y Docker |

### Compatibility check

Revisado contra `knowledge/stack-compatibility.md`: ninguna de sus filas de combinaciones conocidas
como malas aplica, con una salvedad que este blueprint resuelve explícitamente:

- **Linter con parser CSS propio + Tailwind v4 (`@theme`)**: Biome y Tailwind v4 están ambos en el
  stack. `biome.json` (emitido en §19.6) trae `css.parser.tailwindDirectives: true` desde antes del
  primer `pnpm lint` del paso 1.
- Un solo proveedor de identidad (better-auth); Microsoft es un proveedor social *dentro* de
  better-auth, no un segundo dueño de sesión.
- Sin hosting serverless: App Service es un proceso de larga vida, así que el pool de `postgres`
  (máx. 10 conexiones) no agota el servidor.
- Una sola fuente de esquema (drizzle); el editor de esquema del portal de Azure queda prohibido.

Gotchas del track que este blueprint arrastra: `proxy.ts` en vez de `middleware.ts`;
`pnpm-workspace.yaml` solo con `allowBuilds` (pnpm 12 rechaza claves desconocidas);
`corepack enable --install-directory`; `next/font` no permite exigir `font-display` sobre todo el
CSS construido (el criterio se pone en la llamada al loader); TypeScript fijado a `~6.0.3`; Drizzle
fijado a la línea 0.x exacta.

---

## 3. Directory Structure

```
corban-portal-cdt/
├── .claude/                              # (workspace) configuración del agente constructor
│   ├── settings.json                     # §19.3 — allowlist de cada comando de Verify y de §20.1
│   ├── rules/                            # §19.5 — server.md, api-v1.md, db.md, ui.md, pruebas.md
│   └── skills/                           # §19.4 — agregar-entidad, regenerar-golden, agregar-migracion
├── .github/workflows/ci.yml              # (workspace, §19.6) gate de CI = §20.1
├── assets/formatos/                      # (workspace, insumo) 6 PDF AcroForm oficiales + mapping.json
│                                         #   + mapping.cuenta-pago.json. Nunca se editan a mano.
├── blueprints/corban-portal-cdt/         # este bundle; excluido de biome, tsc, vitest y docker
├── docs/
│   ├── poc/app.reference.js.txt          # (workspace) app.js del POC, solo referencia (.txt: nada lo lintea)
│   ├── referencia/esquema.ts.txt         # (workspace) esquema completo = §4
│   ├── referencia/contratos.md           # (workspace) contratos de §5 y §8, para los epics
│   ├── pruebas-pdf/                      # (workspace) evidencia de la prueba de los 6 PDF (RESULTADO.md, fill.cjs, imagenes/)
│   └── lanzamiento.md                    # paso 20 — lista de lanzamiento con comandos az
├── drizzle/                              # migraciones que emite `pnpm db:generate` (pasos 2 y 3), commiteadas
├── public/logo.png                       # (workspace) logo oficial 144×112 (SVG pendiente del cliente)
├── scripts/
│   ├── bootstrap.sh                      # (workspace) mismos comandos que el bloque Bootstrap de §10
│   ├── migrate.ts                        # (workspace) pnpm db:migrate
│   ├── db-test-prepare.ts                # (workspace) pnpm db:test:prepare — recrea corban_test
│   ├── semilla-e2e.ts                    # (workspace) staff fijo para E2E
│   ├── smoke-standalone.sh               # (workspace) arranca .next/standalone/server.js y consulta una ruta
│   ├── seed.ts                           # paso 3 — pnpm db:seed / pnpm db:seed:demo
│   └── smoke-docker.sh                   # paso 20 — arranca la imagen y consulta /api/health
├── src/
│   ├── proxy.ts                          # paso 6 — redirecciones gruesas sin sesión; NO autoriza
│   ├── app/
│   │   ├── layout.tsx                    # (workspace) → paso 8: fuentes locales, enlace "Saltar al contenido"
│   │   ├── globals.css                   # (workspace) tokens @theme → paso 8 añade tw-animate-css
│   │   ├── fonts/                        # (workspace) inter-latin, inter-latin-ext, poppins500/600/700 .woff2
│   │   ├── manifest.ts                   # paso 18 — /manifest.webmanifest
│   │   ├── iconos/[tamano]/route.tsx     # paso 18 — íconos PWA 192 y 512 (next/og)
│   │   ├── (publico)/                    # pasos 1 y 6 — /, /ingreso, /registro, /invitacion/[token],
│   │   │                                 #   /consentimiento, /ingreso-staff
│   │   ├── (cliente)/mi-cuenta/          # pasos 8, 10, 15 — layout con puerta de consentimiento; inicio,
│   │   │                                 #   solicitudes/nueva, solicitudes/[id], solicitudes/[id]/editar, portafolio
│   │   ├── (staff)/                      # paso 8 — layout del staff
│   │   │   ├── asesor/                   # pasos 14 y 15 — bandeja, solicitudes, solicitudes/[id], clientes
│   │   │   ├── coordinador/              # pasos 7 (condiciones, festivos, entidades) y 16 (importar)
│   │   │   ├── gerencia/                 # paso 17 — reportes
│   │   │   └── admin/                    # paso 18 — staff
│   │   └── api/
│   │       ├── health/route.ts           # (workspace) {status:"ok"} sin base de datos
│   │       ├── health/db/route.ts        # paso 2 — {status:"ok",db:"ok"}
│   │       ├── auth/[...all]/route.ts    # paso 5 — better-auth + límites de OTP + bloqueo de OTP a staff
│   │       ├── test/login/route.ts       # paso 5 — sesión de staff para E2E; 404 en producción
│   │       ├── v1/                       # pasos 6, 9, 12, 13, 15 — API de cliente (contrato de la app móvil)
│   │       └── staff/                    # pasos 12, 13, 16, 17 — acciones y descargas del staff
│   ├── components/
│   │   ├── ui/                           # paso 8 — generados por shadcn (lint desactivado en biome.json)
│   │   ├── shell/                        # paso 8 — ShellPublico, ShellCliente, ShellStaff, SaltarAlContenido
│   │   ├── cliente/                      # pasos 10 y 13 — asistente, campos, hooks de react-query, carga firmada
│   │   └── staff/                        # pasos 14 y 17 — tabla paginada, línea de tiempo, gráficos
│   ├── lib/
│   │   ├── env.ts                        # (workspace) única lectura de process.env de la app
│   │   ├── logger.ts                     # paso 4 — JSON por línea con request id, redacción de PII
│   │   ├── utils.ts                      # paso 8 — generado por shadcn (`cn`)
│   │   └── datos/                        # paso 9 — catálogos y esquemas zod compartidos (puros, sin I/O)
│   └── server/
│       ├── db/                           # pasos 2 y 3 — schema.ts, client.ts, seed-base.ts
│       ├── authz/                        # paso 4 — can(), matriz, actor, ErrorDominio, respuestas HTTP
│       ├── auditoria/                    # paso 4 — conAuditoria() en la misma transacción
│       ├── auth/                         # paso 5 — better-auth, getActor, staff, límites, sesión de prueba
│       ├── correo/                       # paso 5 — MailDriver (file/smtp/acs) + plantillas
│       ├── clientes/acceso/              # paso 6 — registro, invitaciones, consentimiento
│       ├── condiciones/                  # paso 7 — motor puro, en-letras, repositorio, solapes
│       ├── solicitudes/                  # pasos 9, 12, 14, 18 — servicio, transiciones, consultas, edición, notificaciones
│       ├── almacenamiento/               # paso 12 — StorageDriver fs/azure
│       ├── pdf/                          # paso 11 — motor PDF (port del POC)
│       ├── firmas/                       # paso 13 — validación de bytes, unión de imágenes
│       ├── portafolio/                   # paso 15 — constitución y consultas de cdts
│       ├── importacion/                  # paso 16 — Excel, perfiles, vista previa, upsert
│       └── reportes/                     # paso 17 — consultas y exportación xlsx
├── tests/
│   ├── setup.ts                          # (workspace) carga .env y apunta DATABASE_URL a TEST_DATABASE_URL
│   ├── helpers/fabricas.ts               # paso 7 — fábricas de staff, clientes, sesiones y condiciones
│   ├── fixtures/cliente-ejemplo.json     # paso 11 — cliente ficticio del POC
│   ├── unit/                             # health (workspace), authz, motor-calculo, contraste, pdf-mapeo, pdf-golden, ci
│   │   └── __snapshots__/                # paso 11 — pdf-<docKey>.json, los escribe la primera ejecución
│   ├── integration/                      # una prueba por paso con base real (corban_test)
│   └── e2e/                              # preparar.ts (workspace), apoyo.ts, responsive, asistente, flujos
├── .dockerignore · Dockerfile            # paso 20
├── .env.example · .gitignore · .nvmrc    # (workspace)
├── AGENTS.md · CLAUDE.md                 # (workspace)
├── biome.json · tsconfig.json            # (workspace)
├── next.config.ts                        # (workspace) → paso 19 añade cabeceras de seguridad
├── postcss.config.mjs                    # (workspace)
├── docker-compose.yml · drizzle.config.ts  # (workspace)
├── package.json · pnpm-workspace.yaml    # (workspace); pnpm-lock.yaml lo crea Bootstrap y lo commitea el paso 1
├── playwright.config.ts · vitest.config.mts  # (workspace)
└── README.md                             # paso 1
```

Las rutas de salida que este árbol nombra (`.next/standalone/server.js`, `drizzle/`) son valores
que también declaran archivos emitidos; su fuente única está en la tabla *Cross-artifact value
reconciliation* de §19.6.

**Reglas de frontera**
- `src/components/**` y todo archivo con `"use client"` nunca importan de `src/server/**` ni de
  `src/lib/env.ts`. Los datos llegan a los componentes de cliente por la API (`/api/v1/**` con
  react-query) o como props desde un Server Component.
- `src/server/db/client.ts` es el único lugar que abre una conexión a Postgres; `src/server/db/schema.ts`
  no importa nada del proyecto (drizzle-kit lo carga sin alias).
- Toda lectura o escritura de dominio pasa por un servicio de `src/server/<feature>/`, que llama
  `can()` de `src/server/authz/` **antes** del trabajo y escribe auditoría con `conAuditoria()` en la
  misma transacción. Ningún route handler, server action ni componente consulta tablas directamente.
- `src/lib/**` es código puro (sin I/O) salvo `env.ts` y `logger.ts`.
- Los route handlers leen cabeceras y cuerpo **del parámetro `request`**, nunca de `next/headers`,
  para poder probarlos llamándolos directamente desde Vitest.
- La convención de imports (relativos con extensión `.ts`/`.tsx`; alias `@/` sin extensión) es una convención
  de resolución: su forma única y su reconciliación con cada cargador están en la *Resolution
  convention matrix* de §19.6.

---

## 4. Data Model

Convenciones: tablas en plural `snake_case` (salvo las cuatro de better-auth, que usan sus nombres
de modelo); claves `uuid` con `gen_random_uuid()` salvo `user`/`session`/`account`/`verification`
(texto, las genera better-auth), `entidades` (texto legible: `ban100`) y `festivos` (la fecha).
**Dinero = `bigint` en pesos COP enteros** (`mode: "number"`, seguro hasta 9·10¹⁵). Fechas de
negocio = `date` (`yyyy-mm-dd`); instantes = `timestamptz`. Borrado lógico (`deleted_at`) en
`clientes` y `solicitudes`; nada de dominio se borra físicamente. Correos se guardan en minúsculas.

### Entities

**user / session / account / verification** — tablas de better-auth 1.7, **escritas a mano** en
`schema.ts` (decisión: no se usa el CLI `auth`, ver §20.3). Propiedades con los nombres que espera
el adaptador Drizzle (`emailVerified`, `expiresAt`, `providerId`…), columnas en snake_case.
`user.email` único. `session.token` único, `session.user_id` → `user` en cascada.
`account (provider_id, account_id)` identifica la cuenta del proveedor (`microsoft` para staff).
`verification` guarda los OTP (`identifier`, `value`, `expires_at`).

**staff_members** — la lista blanca del staff: solo un correo activo aquí puede entrar con Entra.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| email | text | not null, único sobre `lower(email)` | Debe coincidir con el UPN de Entra |
| nombre | text | not null | Se muestra en la bandeja y en correos |
| rol | text | not null, check ∈ asesor, coordinador, gerencia, admin | Un rol por persona |
| activo | boolean | not null, default true | Desactivar borra sus sesiones |
| user_id | text | FK → user, on delete set null | Se enlaza en el primer ingreso |
| created_at / updated_at | timestamptz | not null | — |

**clientes** — la persona natural que invierte; su perfil se diligencia una vez y precarga cada solicitud.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| user_id | text | único, nullable, FK → user set null | Nulo hasta el primer OTP (registro, invitación o importación) |
| tipo_doc / num_doc | text | not null; único (tipo_doc, num_doc); check tipo ∈ CC, CE, TI, PAS, NUIP | Identidad de negocio |
| email | text | not null, índice sobre `lower(email)` | Correo de acceso por OTP |
| nombre | text | not null | Nombre completo para búsqueda y listados |
| celular | text | nullable | — |
| asesor_id | uuid | FK → staff_members set null, índice | Visibilidad del asesor |
| origen | text | not null, check ∈ registro, invitacion, importacion | — |
| perfil | jsonb | not null default `{}` | Claves de perfil del §5 *Catálogos* (texto), validadas con zod al escribir |
| created_at / updated_at / deleted_at | timestamptz | — | Borrado lógico |

**invitaciones** — enlace de un solo uso que el asesor envía a un cliente.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| cliente_id | uuid | not null, FK → clientes cascade, índice | El cliente se crea al invitar |
| asesor_id | uuid | not null, FK → staff_members | Queda como asesor del cliente al aceptar |
| email | text | not null | — |
| token_hash | text | not null, único | SHA-256 del token; el token en claro solo viaja en el correo |
| expires_at | timestamptz | not null | Creación + 7 días |
| accepted_at | timestamptz | nullable | Un solo uso |
| created_at | timestamptz | not null | — |

**consentimientos** — evidencia de la autorización Ley 1581 por usuario y versión del texto.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| user_id | text | not null, FK → user; único (user_id, version) | — |
| cliente_id | uuid | FK → clientes, nullable | — |
| version | text | not null | `2026-11-v1` en v1 |
| accepted_at | timestamptz | not null default now | — |
| ip / user_agent | text | nullable | IP de `x-forwarded-for` (primer valor) |

**entidades** — las 4 entidades financieras y sus reglas de cálculo.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | text | PK | `ban100`, `colte`, `juris`, `mmujer` |
| nombre | text | not null | — |
| doc_keys | text[] | not null | `{ban_vinc,ban_orden}`, `{colte_vinc,colte_cdt}`, `{juris}`, `{mmujer}` |
| monto_minimo | bigint | not null default 0, ≥ 0 | Lo ajusta el coordinador |
| base_calculo | text | check ∈ calendario, comercial_360; default calendario | — |
| ajuste_no_habil | text | check ∈ siguiente_habil, anterior_habil, ninguno; default siguiente_habil | — |
| plazo_en_meses | boolean | default false | `true` solo Juriscoop: la UI muestra el plazo en meses |
| activa | boolean | default true | — |

**condiciones_tasa** — tabla de tasas por entidad, plazo, rango de monto, periodicidad y vigencia.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| entidad_id | text | not null, FK → entidades | — |
| plazo_dias | integer | not null, > 0 | Opción ofrecida al cliente |
| monto_min / monto_max | bigint | min not null ≥ 0; max nullable ≥ min | Rango inclusivo |
| periodicidad | text | check ∈ vencimiento, mensual, bimestral, trimestral, semestral, anual | — |
| tasa_ea | numeric(6,4) | not null, > 0 | Porcentaje E.A. (10.5000 = 10,5 %) |
| vigente_desde / vigente_hasta | date | desde not null; hasta nullable ≥ desde | — |
| creado_por | uuid | FK → staff_members set null | — |
| índice | (entidad_id, plazo_dias, periodicidad) | — | Búsqueda del motor |

**festivos** — `fecha` date PK, `nombre` text not null, `created_at`. **La semilla lo deja vacío**:
el coordinador carga los festivos oficiales (no se inventan fechas).

**solicitudes** — una solicitud de apertura de CDT y su estado.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| numero | bigserial | único | Secuencia del código |
| codigo | text | generada `'SOL-' \|\| lpad(numero::text, 6, '0')`, única | `SOL-000001` |
| cliente_id | uuid | not null, FK → clientes, índice | — |
| asesor_id | uuid | FK → staff_members set null; índice (asesor_id, estado) | Copia del asesor del cliente al crear |
| entidad_id | text | not null, FK → entidades | — |
| estado | text | check ∈ los 9 estados del §5 *Máquina de estados*; default borrador | — |
| version_actual | integer | default 0 | 0 antes de aprobar; 1 al aprobar; +1 por edición posterior |
| datos | jsonb | default `{}` | Todas las claves del asistente (texto) |
| valor, plazo_dias, periodicidad, tasa_ea, fecha_apertura, fecha_venc, condicion_id | — | nullable hasta aprobar | **Congelados al aprobar**; `condicion_id` → condiciones_tasa |
| aprobada_at, aprobada_por | timestamptz, uuid | — | — |
| fecha_envio, radicado | date, text | — | Al marcar `enviada_entidad` |
| observacion, motivo_cancelacion | text | — | Última devolución / cancelación |
| constituida_at | timestamptz | — | Base del promedio de días del reporte |
| creado_por | text | FK → user set null | — |
| created_at / updated_at / deleted_at | timestamptz | índice en created_at | — |

**solicitud_versiones** — instantánea de `datos` y de las condiciones congeladas por versión;
único (solicitud_id, numero); `motivo` (nulo en la versión 1), `creado_por`, `created_at`.

**documentos** — cada PDF generado o firmado, por versión.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| solicitud_id | uuid | FK → solicitudes; índice (solicitud_id, version) | — |
| version | integer | not null | = `version_actual` al crearse |
| tipo | text | check ∈ generado, firmado | — |
| doc_key | text | nullable | Nulo en firmados |
| storage_path | text | not null, único | `solicitudes/<id>/v<version>/<archivo>` |
| nombre_archivo, sha256, bytes | text, text, integer | not null | sha256 hex del contenido |
| estado | text | check ∈ vigente, desactualizado, aceptado, rechazado; default vigente | — |
| motivo_rechazo | text | — | — |
| subido_por | text | FK → user set null | — |

**solicitud_eventos** — línea de tiempo: `tipo` ∈ transicion, nota, edicion; `desde`, `hacia`,
`actor_user_id`, `nota`, `notificado_at` (nulo si el correo no salió); índice (solicitud_id, created_at).

**audit_events** — auditoría **solo inserción** (trigger que rechaza UPDATE/DELETE/TRUNCATE con
SQLSTATE `42501`): `id` bigserial, `actor_id` (sin FK a propósito), `actor_ip`, `accion`,
`target_type`, `target_id`, `occurred_at`, `metadata` jsonb (diffs en `metadata.cambios` como
lista de `{campo, antes, despues}`). Índices por objetivo, fecha y actor.

**cdts** — el portafolio: CDT constituidos desde una solicitud o importados.

| Campo | Tipo | Restricciones | Notas |
|---|---|---|---|
| id | uuid | PK | — |
| cliente_id | uuid | not null, FK → clientes, índice | — |
| entidad_id | text | not null, FK → entidades | — |
| numero_cdt | text | not null; único (entidad_id, numero_cdt) | Clave de idempotencia de la importación |
| valor | bigint | not null | — |
| tasa_ea | numeric(6,4) | not null | — |
| fecha_apertura / fecha_venc | date | not null; índice en fecha_venc | — |
| periodicidad | text | check de periodicidades | — |
| estado | text | check ∈ vigente, vencido, cancelado; default vigente | "Vigente" en lectura = estado vigente y fecha_venc ≥ hoy |
| origen | text | check ∈ solicitud, importacion | — |
| solicitud_id | uuid | único, nullable, FK → solicitudes | — |

**import_perfiles** — `nombre` único, `mapeo` jsonb `{ "<columna del Excel>": "<destino>" }`,
`creado_por`. **import_cargas** — `perfil_id`, `archivo_nombre`, `filas_creadas`,
`filas_actualizadas`, `filas_sin_cambios`, `filas_rechazadas`, `rechazos_storage_path`,
`actor_user_id`, `created_at`. **rate_limits** — `clave` PK, `conteo`, `ventana_inicio`.

### Relationships

- `user` —(1:N)→ `session`, `account` · on delete cascade.
- `user` —(1:0..1)→ `clientes.user_id` y `staff_members.user_id` · on delete set null.
- `staff_members` —(1:N)→ `clientes.asesor_id`, `solicitudes.asesor_id` · set null (el cliente queda sin asesor y lo ve el coordinador).
- `clientes` —(1:N)→ `solicitudes`, `cdts`, `consentimientos` · restrict (no action): nada se borra físicamente.
- `clientes` —(1:N)→ `invitaciones` · cascade.
- `entidades` —(1:N)→ `condiciones_tasa`, `solicitudes`, `cdts` · restrict.
- `condiciones_tasa` —(1:N)→ `solicitudes.condicion_id` · restrict (una condición usada no se borra; se cierra con `vigente_hasta`).
- `solicitudes` —(1:N)→ `solicitud_versiones`, `documentos`, `solicitud_eventos` · restrict.
- `solicitudes` —(1:0..1)→ `cdts.solicitud_id` · restrict.
- `import_perfiles` —(1:N)→ `import_cargas` · restrict.
- `audit_events` no referencia nada: sobrevive a cualquier borrado.

### Indexes

| Tabla | Índice | Por qué |
|---|---|---|
| clientes | único (tipo_doc, num_doc) | Identidad de negocio; upsert de la importación |
| clientes | asesor_id | "Mis clientes" del asesor |
| clientes | lower(email) | Enlace del OTP con el cliente |
| staff_members | único lower(email) | Lista blanca de Entra |
| solicitudes | (asesor_id, estado) | Bandeja del asesor |
| solicitudes | estado · created_at · cliente_id | Listados del coordinador, reportes, "mis solicitudes" |
| solicitudes | único codigo | Búsqueda por código |
| condiciones_tasa | (entidad_id, plazo_dias, periodicidad) | Motor de cálculo y opciones del asistente |
| documentos | (solicitud_id, version) | Documentos por versión |
| solicitud_eventos | (solicitud_id, created_at) | Línea de tiempo |
| cdts | único (entidad_id, numero_cdt) · cliente_id · fecha_venc | Idempotencia, portafolio, vencimientos |
| audit_events | (target_type, target_id) · occurred_at · actor_id | Consultas de auditoría |

### Schema

`src/server/db/schema.ts` completo desde el paso 3 (copia idéntica en
`docs/referencia/esquema.ts.txt`). El paso 2 escribe solo el bloque `festivos` con sus imports
(`date`, `pgTable`, `text`, `timestamp`).

```ts
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ROLES_STAFF = ["asesor", "coordinador", "gerencia", "admin"] as const;

export const ESTADOS_SOLICITUD = [
  "borrador",
  "pendiente_validacion",
  "devuelta",
  "pendiente_firma",
  "firma_en_revision",
  "lista_para_enviar",
  "enviada_entidad",
  "cdt_constituido",
  "cancelada",
] as const;

export const PERIODICIDADES = [
  "vencimiento",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
] as const;

const creadoEn = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const actualizadoEn = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const fecha = (nombre: string) => date(nombre, { mode: "string" });
const pesos = (nombre: string) => bigint(nombre, { mode: "number" });
const tasa = (nombre: string) => numeric(nombre, { precision: 6, scale: 4 });

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: creadoEn(),
  updatedAt: actualizadoEn(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    rol: text("rol", { enum: ROLES_STAFF }).notNull(),
    activo: boolean("activo").notNull().default(true),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("staff_members_email_uq").on(sql`lower(${t.email})`),
    check("staff_members_rol_ck", sql`${t.rol} in ('asesor', 'coordinador', 'gerencia', 'admin')`),
  ],
);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    tipoDoc: text("tipo_doc").notNull(),
    numDoc: text("num_doc").notNull(),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    celular: text("celular"),
    asesorId: uuid("asesor_id").references(() => staffMembers.id, { onDelete: "set null" }),
    origen: text("origen").notNull().default("registro"),
    perfil: jsonb("perfil").$type<Record<string, string>>().notNull().default({}),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("clientes_documento_uq").on(t.tipoDoc, t.numDoc),
    index("clientes_asesor_idx").on(t.asesorId),
    index("clientes_email_idx").on(sql`lower(${t.email})`),
    check("clientes_tipo_doc_ck", sql`${t.tipoDoc} in ('CC', 'CE', 'TI', 'PAS', 'NUIP')`),
    check("clientes_origen_ck", sql`${t.origen} in ('registro', 'invitacion', 'importacion')`),
  ],
);

export const invitaciones = pgTable(
  "invitaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    asesorId: uuid("asesor_id")
      .notNull()
      .references(() => staffMembers.id),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: creadoEn(),
  },
  (t) => [index("invitaciones_cliente_idx").on(t.clienteId)],
);

export const consentimientos = pgTable(
  "consentimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("consentimientos_usuario_version_uq").on(t.userId, t.version)],
);

export const entidades = pgTable(
  "entidades",
  {
    id: text("id").primaryKey(),
    nombre: text("nombre").notNull(),
    docKeys: text("doc_keys").array().notNull(),
    montoMinimo: pesos("monto_minimo").notNull().default(0),
    baseCalculo: text("base_calculo").notNull().default("calendario"),
    ajusteNoHabil: text("ajuste_no_habil").notNull().default("siguiente_habil"),
    plazoEnMeses: boolean("plazo_en_meses").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    check("entidades_base_ck", sql`${t.baseCalculo} in ('calendario', 'comercial_360')`),
    check(
      "entidades_ajuste_ck",
      sql`${t.ajusteNoHabil} in ('siguiente_habil', 'anterior_habil', 'ninguno')`,
    ),
    check("entidades_monto_ck", sql`${t.montoMinimo} >= 0`),
  ],
);

export const condicionesTasa = pgTable(
  "condiciones_tasa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entidadId: text("entidad_id")
      .notNull()
      .references(() => entidades.id),
    plazoDias: integer("plazo_dias").notNull(),
    montoMin: pesos("monto_min").notNull(),
    montoMax: pesos("monto_max"),
    periodicidad: text("periodicidad", { enum: PERIODICIDADES }).notNull(),
    tasaEa: tasa("tasa_ea").notNull(),
    vigenteDesde: fecha("vigente_desde").notNull(),
    vigenteHasta: fecha("vigente_hasta"),
    creadoPor: uuid("creado_por").references(() => staffMembers.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    index("condiciones_busqueda_idx").on(t.entidadId, t.plazoDias, t.periodicidad),
    check("condiciones_plazo_ck", sql`${t.plazoDias} > 0`),
    check("condiciones_monto_ck", sql`${t.montoMin} >= 0`),
    check("condiciones_rango_ck", sql`${t.montoMax} is null or ${t.montoMax} >= ${t.montoMin}`),
    check("condiciones_tasa_ck", sql`${t.tasaEa} > 0`),
    check(
      "condiciones_vigencia_ck",
      sql`${t.vigenteHasta} is null or ${t.vigenteHasta} >= ${t.vigenteDesde}`,
    ),
    check(
      "condiciones_periodicidad_ck",
      sql`${t.periodicidad} in ('vencimiento', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual')`,
    ),
  ],
);

export const festivos = pgTable("festivos", {
  fecha: date("fecha", { mode: "string" }).primaryKey(),
  nombre: text("nombre").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const solicitudes = pgTable(
  "solicitudes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numero: bigserial("numero", { mode: "number" }).notNull(),
    codigo: text("codigo").generatedAlwaysAs(sql`'SOL-' || lpad(numero::text, 6, '0')`),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    asesorId: uuid("asesor_id").references(() => staffMembers.id, { onDelete: "set null" }),
    entidadId: text("entidad_id")
      .notNull()
      .references(() => entidades.id),
    estado: text("estado", { enum: ESTADOS_SOLICITUD }).notNull().default("borrador"),
    versionActual: integer("version_actual").notNull().default(0),
    datos: jsonb("datos").$type<Record<string, string>>().notNull().default({}),
    valor: pesos("valor"),
    plazoDias: integer("plazo_dias"),
    periodicidad: text("periodicidad", { enum: PERIODICIDADES }),
    tasaEa: tasa("tasa_ea"),
    fechaApertura: fecha("fecha_apertura"),
    fechaVenc: fecha("fecha_venc"),
    condicionId: uuid("condicion_id").references(() => condicionesTasa.id),
    aprobadaAt: timestamp("aprobada_at", { withTimezone: true }),
    aprobadaPor: uuid("aprobada_por").references(() => staffMembers.id, { onDelete: "set null" }),
    fechaEnvio: fecha("fecha_envio"),
    radicado: text("radicado"),
    observacion: text("observacion"),
    motivoCancelacion: text("motivo_cancelacion"),
    constituidaAt: timestamp("constituida_at", { withTimezone: true }),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("solicitudes_numero_uq").on(t.numero),
    uniqueIndex("solicitudes_codigo_uq").on(t.codigo),
    index("solicitudes_cliente_idx").on(t.clienteId),
    index("solicitudes_asesor_estado_idx").on(t.asesorId, t.estado),
    index("solicitudes_estado_idx").on(t.estado),
    index("solicitudes_creada_idx").on(t.createdAt),
    check(
      "solicitudes_estado_ck",
      sql`${t.estado} in ('borrador', 'pendiente_validacion', 'devuelta', 'pendiente_firma', 'firma_en_revision', 'lista_para_enviar', 'enviada_entidad', 'cdt_constituido', 'cancelada')`,
    ),
  ],
);

export const solicitudVersiones = pgTable(
  "solicitud_versiones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    numero: integer("numero").notNull(),
    datos: jsonb("datos").$type<Record<string, string>>().notNull(),
    condiciones: jsonb("condiciones").$type<Record<string, string | number>>().notNull(),
    motivo: text("motivo"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
  },
  (t) => [uniqueIndex("solicitud_versiones_numero_uq").on(t.solicitudId, t.numero)],
);

export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    version: integer("version").notNull(),
    tipo: text("tipo").notNull(),
    docKey: text("doc_key"),
    storagePath: text("storage_path").notNull().unique(),
    nombreArchivo: text("nombre_archivo").notNull(),
    sha256: text("sha256").notNull(),
    bytes: integer("bytes").notNull(),
    estado: text("estado").notNull().default("vigente"),
    motivoRechazo: text("motivo_rechazo"),
    subidoPor: text("subido_por").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    index("documentos_solicitud_version_idx").on(t.solicitudId, t.version),
    check("documentos_tipo_ck", sql`${t.tipo} in ('generado', 'firmado')`),
    check(
      "documentos_estado_ck",
      sql`${t.estado} in ('vigente', 'desactualizado', 'aceptado', 'rechazado')`,
    ),
  ],
);

export const solicitudEventos = pgTable(
  "solicitud_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    tipo: text("tipo").notNull(),
    desde: text("desde"),
    hacia: text("hacia"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    nota: text("nota"),
    notificadoAt: timestamp("notificado_at", { withTimezone: true }),
    createdAt: creadoEn(),
  },
  (t) => [
    index("solicitud_eventos_solicitud_idx").on(t.solicitudId, t.createdAt),
    check("solicitud_eventos_tipo_ck", sql`${t.tipo} in ('transicion', 'nota', 'edicion')`),
  ],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id"),
    actorIp: text("actor_ip"),
    accion: text("accion").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index("audit_events_target_idx").on(t.targetType, t.targetId),
    index("audit_events_fecha_idx").on(t.occurredAt),
    index("audit_events_actor_idx").on(t.actorId),
  ],
);

export const cdts = pgTable(
  "cdts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    entidadId: text("entidad_id")
      .notNull()
      .references(() => entidades.id),
    numeroCdt: text("numero_cdt").notNull(),
    valor: pesos("valor").notNull(),
    tasaEa: tasa("tasa_ea").notNull(),
    fechaApertura: fecha("fecha_apertura").notNull(),
    fechaVenc: fecha("fecha_venc").notNull(),
    periodicidad: text("periodicidad", { enum: PERIODICIDADES }).notNull(),
    estado: text("estado").notNull().default("vigente"),
    origen: text("origen").notNull(),
    solicitudId: uuid("solicitud_id")
      .unique()
      .references(() => solicitudes.id),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("cdts_entidad_numero_uq").on(t.entidadId, t.numeroCdt),
    index("cdts_cliente_idx").on(t.clienteId),
    index("cdts_vencimiento_idx").on(t.fechaVenc),
    check("cdts_estado_ck", sql`${t.estado} in ('vigente', 'vencido', 'cancelado')`),
    check("cdts_origen_ck", sql`${t.origen} in ('solicitud', 'importacion')`),
  ],
);

export const importPerfiles = pgTable("import_perfiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  mapeo: jsonb("mapeo").$type<Record<string, string>>().notNull(),
  creadoPor: uuid("creado_por").references(() => staffMembers.id, { onDelete: "set null" }),
  createdAt: creadoEn(),
  updatedAt: actualizadoEn(),
});

export const importCargas = pgTable("import_cargas", {
  id: uuid("id").primaryKey().defaultRandom(),
  perfilId: uuid("perfil_id")
    .notNull()
    .references(() => importPerfiles.id),
  archivoNombre: text("archivo_nombre").notNull(),
  filasCreadas: integer("filas_creadas").notNull().default(0),
  filasActualizadas: integer("filas_actualizadas").notNull().default(0),
  filasSinCambios: integer("filas_sin_cambios").notNull().default(0),
  filasRechazadas: integer("filas_rechazadas").notNull().default(0),
  rechazosStoragePath: text("rechazos_storage_path"),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: creadoEn(),
});

export const rateLimits = pgTable("rate_limits", {
  clave: text("clave").primaryKey(),
  conteo: integer("conteo").notNull(),
  ventanaInicio: timestamp("ventana_inicio", { withTimezone: true }).notNull(),
});
```

### Migrations

- **Herramienta:** drizzle-kit. `pnpm db:generate` (= `dotenv -e .env -- drizzle-kit generate`)
  compara `schema.ts` con `drizzle/meta` y **emite un archivo SQL con nombre elegido por la
  herramienta** (número + palabras aleatorias): nunca se escribe ni se cita un nombre a mano. Se
  refiere a ellas como "la migración que emite `pnpm db:generate` en el paso N".
- **Aplicar:** `pnpm db:migrate` (`scripts/migrate.ts`, migrador de drizzle-orm) — explícito,
  idempotente, **nunca al arrancar la app**. En producción es un paso de release (§12).
- **Migración personalizada (única excepción a "no editar `drizzle/` a mano"):** en el paso 3,
  `pnpm db:generate --custom --name=auditoria_inmutable` crea un SQL vacío (el más nuevo de
  `drizzle/`) y el constructor escribe en él exactamente:

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

- **Regla de producción:** expandir y luego contraer. Una migración que agrega columnas o tablas
  sale antes que el código que las usa; nunca se borra ni renombra una columna en el mismo release
  que el código que deja de usarla. Nada destructivo sin respaldo previo del Flexible Server (§12).
- **Pruebas:** `pnpm db:test:prepare` recrea `corban_test` y aplica todas las migraciones; las
  pruebas nunca truncan tablas (el trigger lo impediría en `audit_events`): cada prueba crea sus
  propias filas con claves únicas.

### Seed data

`src/server/db/seed-base.ts` exporta `sembrarBase(db, { adminEmail, demo })`, idempotente;
`scripts/seed.ts` la invoca (`pnpm db:seed`; `pnpm db:seed:demo` añade `--demo`).

| Qué | Valor | Idempotencia |
|---|---|---|
| entidades | `ban100` Ban100 `{ban_vinc,ban_orden}` · `colte` Coltefinanciera `{colte_vinc,colte_cdt}` · `juris` Juriscoop `{juris}` con `plazo_en_meses` true · `mmujer` Mundo Mujer `{mmujer}`; todas con `monto_minimo` 0, `calendario`, `siguiente_habil` (el coordinador los ajusta en `/coordinador/condiciones`) | `on conflict (id) do nothing` — no pisa ajustes del coordinador |
| staff admin | `ADMIN_EMAIL`, nombre "Administración", rol `admin`, activo | `on conflict do nothing` sobre `lower(email)`; sin `ADMIN_EMAIL` el script termina con código 1 |
| festivos | **ninguno** | — |
| condiciones (solo `--demo`) | por entidad: plazos 90, 180 y 360 días; periodicidad `vencimiento` en los tres y `mensual` en 180 y 360; `monto_min` 1000000, `monto_max` nulo; `vigente_desde` 2026-01-01; tasas de demostración 9.5000 (90), 10.0000 (180), 10.5000 (360) y 0.2 menos en `mensual`. **No son tasas reales**: la UI de condiciones las marca "DEMO" si `creado_por` es nulo | Se insertan solo si la entidad no tiene ninguna condición |

---

## 5. API Design

La API del cliente (`/api/v1/**`) es el **contrato de la futura app móvil**: versionada en la ruta,
cuerpos validados con zod, errores tipados. El área de staff usa route handlers bajo
`/api/staff/**` (descargas, transiciones que la UI invoca con `fetch`) o server actions; ambos
llaman los mismos servicios de `src/server/**` y el mismo `can()`. Copia de referencia de todos los
contratos de esta sección y de §8 dentro del proyecto: `docs/referencia/contratos.md` (emitido en
§19.6), que es lo que leen los epics.

### Conventions

- **Base path:** `/api/v1` (cliente) · `/api/staff` (staff) · `/api/auth` (better-auth) · `/api/test/login` (solo fuera de producción).
- **Envelope (una sola forma):** éxito `{ "data": … }`; listas `{ "data": [...], "meta": { "pagina": 1, "porPagina": 25, "total": 60 } }`;
  error `{ "error": { "code": "VALIDACION", "message": "Falta completar: primer nombre", "fields": { "nombre1": "Obligatorio" } } }` (`fields` solo en `VALIDACION`).
- **Error codes:**

| Código | HTTP | Cuándo |
|---|---|---|
| `NO_AUTENTICADO` | 401 | Sin sesión válida |
| `PROHIBIDO` | 403 | El actor ve el recurso pero la acción no le está permitida |
| `CONSENTIMIENTO_REQUERIDO` | 403 | Cliente sin consentimiento de la versión vigente |
| `PERFIL_REQUERIDO` | 403 | Usuario cliente sin fila en `clientes` |
| `USAR_MICROSOFT` | 403 | Un correo de staff pidió OTP |
| `NO_ENCONTRADO` | 404 | No existe **o** el actor no puede verlo (nunca 403 para recursos ajenos) |
| `TRANSICION_INVALIDA` | 409 | Acción no permitida desde el estado actual |
| `CONFLICTO` | 409 | Unicidad de negocio (p. ej. `numero_cdt` repetido) |
| `DOCUMENTO_REGISTRADO` | 409 | Registro con documento existente y otro correo |
| `CONDICION_SOLAPADA` | 409 | Condición que se cruza con otra vigente |
| `INVITACION_INVALIDA` | 410 | Token vencido, usado o inexistente |
| `CARGA_DEMASIADO_GRANDE` | 413 | > 10 archivos o > 15 MB |
| `TIPO_NO_PERMITIDO` | 415 | Bytes que no son PDF, JPEG ni PNG |
| `VALIDACION` | 422 | Cuerpo inválido u obligatorios vacíos |
| `SIN_CONDICION` · `CONDICION_AMBIGUA` · `MONTO_MINIMO` | 422 | Errores del motor de cálculo |
| `MOTIVO_REQUERIDO` | 422 | Acción que exige motivo llegó sin él |
| `FECHA_APERTURA_PASADA` | 422 | Aprobación con apertura anterior a hoy (America/Bogota) |
| `LIMITE_EXCEDIDO` | 429 | Límite superado; cabecera `Retry-After` |
| `ERROR_INTERNO` | 500 | Excepción no prevista, registrada con request id y sin PII |

- **Validation:** zod 4; esquemas de dominio en `src/lib/datos/` (compartidos con los formularios),
  esquemas de cuerpo junto a cada route handler. Los servicios lanzan `ErrorDominio(code, message,
  fields?)` (`src/server/authz/errores.ts`); `respuestaError()` (`src/server/authz/respuestas.ts`)
  lo traduce con la tabla anterior; cualquier otra excepción es `ERROR_INTERNO`.
- **Pagination:** por desplazamiento, `?pagina=` (desde 1) y `?porPagina=` (defecto 25, máximo 100),
  siempre `LIMIT/OFFSET` en SQL más un `count(*)` en la misma consulta lógica.
- **Idempotency:** no hay claves de idempotencia (no hay pagos). La idempotencia es de dominio:
  `cdts` único por (entidad, número), importación por claves naturales, transiciones protegidas por
  el estado actual dentro de la transacción (`select … for update`).
- **Rate limits:** tabla `rate_limits` en Postgres (contador por clave y ventana fija, upsert
  atómico): OTP 5 por correo y 20 por IP cada 15 min; registro 10 por IP cada 15 min; carga
  firmada 20 por usuario por hora; verificación de OTP 5 intentos por código (better-auth). El
  `rateLimit` interno de better-auth queda desactivado para no tener dos contadores.

### Routes

| Method | Path | Description | Auth | Rate limit |
|---|---|---|---|---|
| GET | `/api/health` | Proceso vivo, `{status:"ok"}`, sin base | público | — |
| GET | `/api/health/db` | `select 1`, `{status:"ok",db:"ok"}` o 503 | público | — |
| * | `/api/auth/[...all]` | better-auth (sesión, OTP, Microsoft, cierre de sesión) | según ruta | OTP: 5/correo y 20/IP por 15 min |
| POST | `/api/test/login` | Sesión para un staff activo (E2E). **404 en producción** | público, solo `NODE_ENV≠production` y `AUTH_TEST_LOGIN=1` | — |
| POST | `/api/v1/auth/registro` | Crea el cliente pendiente de OTP | público | 10/IP por 15 min |
| GET | `/api/v1/auth/invitaciones/{token}` | Valida invitación, devuelve correo enmascarado | público | — |
| POST | `/api/v1/auth/invitaciones/{token}/aceptar` | Enlaza la invitación con la sesión | cliente | — |
| GET · POST | `/api/v1/consentimiento` | Estado / registro del consentimiento | cliente (sesión) | — |
| GET · PATCH | `/api/v1/perfil` | Perfil del cliente | cliente + consentimiento | — |
| GET | `/api/v1/condiciones/opciones?entidad=&valor=&plazoDias=` | Entidades activas, plazos y periodicidades vigentes con su tasa | cliente | — |
| GET · POST | `/api/v1/solicitudes` | Mis solicitudes / crear borrador | cliente + consentimiento | — |
| GET · PATCH | `/api/v1/solicitudes/{id}` | Detalle con línea de tiempo / autoguardado de un paso | cliente dueño | — |
| POST | `/api/v1/solicitudes/{id}/enviar` | `borrador`/`devuelta` → `pendiente_validacion` | cliente dueño | — |
| GET | `/api/v1/solicitudes/{id}/documentos` | Documentos de la versión actual | cliente dueño | — |
| GET | `/api/v1/solicitudes/{id}/documentos/{docId}` | Descarga (fs: bytes; azure: 302 a SAS de 5 min) | cliente dueño | — |
| POST | `/api/v1/solicitudes/{id}/firmados` | Carga firmada (multipart, `archivos[]`) | cliente dueño | 20/usuario por hora |
| GET | `/api/v1/portafolio` | CDT vigentes, total y próximos vencimientos | cliente | — |
| POST | `/api/staff/solicitudes/{id}/{accion}` | `aprobar`, `devolver`, `cancelar`, `enviar-entidad` | staff según matriz | — |
| POST | `/api/staff/solicitudes/{id}/firma/{accion}` | `aceptar`, `rechazar` | staff según matriz | — |
| GET | `/api/staff/solicitudes/{id}/documentos/{docId}` | Descarga para staff | staff según matriz | — |
| POST | `/api/staff/importaciones/vista-previa` · `/confirmar` | Importación Excel | coordinador, admin | — |
| GET | `/api/staff/importaciones/{cargaId}/rechazos` | .xlsx de rechazos | coordinador, admin | — |
| GET | `/api/staff/reportes/{reporte}/xlsx` | Exportación (`inversion`, `vencimientos`, `solicitudes`) | coordinador, gerencia | — |

Server actions del staff (cada una valida con zod y llama un servicio con `can()`): condiciones,
entidades y festivos (`/coordinador/condiciones`), edición con motivo, notas y reasignación
(`/asesor/solicitudes/[id]`), constitución (paso 15), invitaciones (`/asesor/clientes`), gestión
del staff (`/admin/staff`).

### Critical endpoints — full detail

**`POST /api/v1/auth/registro`**
- Request: `{ tipo_doc: "CC"|"CE"|"TI"|"PAS"|"NUIP", num_doc: string(5–20, dígitos y letras), nombre1, apellido1: string(1–60), email: email, celular: string(10 dígitos) }`.
- 201 `{ data: { clienteId, email } }` — crea `clientes` con `user_id` nulo, `origen` `registro`, `perfil` con esas claves. Si ya existe el par de documento **con el mismo correo** y sin usuario, responde 201 sin duplicar (reintento idempotente).
- 409 `DOCUMENTO_REGISTRADO` si el documento existe con otro correo ("Ya existe un cliente con ese documento. Contacta a tu asesor."). 422 `VALIDACION`. 429 `LIMITE_EXCEDIDO`.
- Efectos: ninguna sesión; la UI envía enseguida el OTP con el cliente de better-auth.

**`POST /api/auth/email-otp/send-verification-otp`** (better-auth, envuelto)
- Antes de delegar: correo de un `staff_members` activo → 403 `USAR_MICROSOFT`; límite `otp:<correo>` 5/15 min y `otp-ip:<ip>` 20/15 min → 429 `LIMITE_EXCEDIDO` **sin escribir correo**.
- Plugin `emailOTP`: 6 dígitos, 10 min de vida, 5 intentos; `sendVerificationOTP` envía la plantilla `otp` por el `MailDriver`.
- `POST /api/auth/sign-in/email-otp` con `{ email, otp }` crea la sesión; en la primera petición autenticada `getActor()` enlaza `clientes.user_id` con el cliente de ese correo que no tenga usuario.

**`POST /api/v1/solicitudes/{id}/enviar`**
- Sin cuerpo. Requiere cliente dueño con consentimiento (o staff con `solicitud.enviar`).
- Valida `datos` con `esquemaEnvio` (obligatorios del §5 *Catálogos y campos*): faltantes → 422 `VALIDACION` con `fields` = `{ clave: "Obligatorio" }` por cada una.
- Ejecuta el motor de cálculo (entidad, `valor`, `plazo_dias`, `periodicidad`, `fecha_apertura`): `MONTO_MINIMO`/`SIN_CONDICION`/`CONDICION_AMBIGUA` → 422 con ese código y mensaje en español.
- Estado no permitido → 409 `TRANSICION_INVALIDA`. Éxito → 200 `{ data: { id, codigo, estado: "pendiente_validacion" } }`; escribe `solicitud_eventos`, `audit_events` (`solicitud.enviar`), copia las claves de perfil a `clientes.perfil` y notifica al asesor (paso 18).

**`POST /api/staff/solicitudes/{id}/aprobar`**
- Sin cuerpo. `can(solicitud.aprobar)`; estado `pendiente_validacion`; `fecha_apertura` ≥ hoy (America/Bogota) o 422 `FECHA_APERTURA_PASADA`.
- En una transacción con `select … for update`: recalcula con el motor y congela los 7 campos; `version_actual` = 1; inserta `solicitud_versiones` 1 (`datos` + `condiciones`); genera un PDF por `doc_key` de la entidad (`src/server/pdf`), los guarda con `StorageDriver.put` en `solicitudes/<id>/v1/<archivo>` e inserta `documentos` (`generado`, `vigente`, sha256, bytes); evento + auditoría; estado `pendiente_firma`.
- Si el reporte del motor PDF trae `notFound` no vacío, la transacción se revierte y responde 500 `ERROR_INTERNO` (nunca un PDF incompleto).

**`POST /api/v1/solicitudes/{id}/firmados`**
- `multipart/form-data`, campo `archivos` repetible: 1–10 archivos, ≤ 15 MB en total (413 `CARGA_DEMASIADO_GRANDE`).
- Tipo por **bytes iniciales**, no por MIME: `%PDF-` → PDF; `FF D8 FF` → JPEG; `89 50 4E 47 0D 0A 1A 0A` → PNG; otro → 415 `TIPO_NO_PERMITIDO` sin guardar nada.
- Un PDF solo: se guarda tal cual. Imágenes (o mezcla): un PDF nuevo con pdf-lib, una página A4 (595.28 × 841.89 pt) por imagen (`embedJpg`/`embedPng`, escalada para caber con 24 pt de margen, centrada); las páginas de PDFs subidos se copian con `copyPages` en el orden recibido.
- Guarda `documentos` (`firmado`, versión = `version_actual`, `vigente`), pasa a `firma_en_revision`, evento + auditoría. Estado distinto de `pendiente_firma` → 409.

### Contratos internos

**Motor de cálculo** (`src/server/condiciones/motor.ts`, función pura): definición completa y casos
fijos en el paso 7 y en `docs/referencia/contratos.md` §4. Resumen: `MONTO_MINIMO` si `valor <
monto_minimo`; filas aplicables por entidad, plazo, periodicidad, rango de monto inclusivo y
vigencia que contiene `fecha_apertura`; 0 → `SIN_CONDICION`, ≥ 2 → `CONDICION_AMBIGUA`; vencimiento
`calendario` (apertura + días) o `comercial_360` (apertura + ⌊días/30⌋ meses con tope al último
día del mes + días % 30); ajuste `siguiente_habil`/`anterior_habil` saltando sábados, domingos y
`festivos`, o `ninguno`; `plazo_meses = Math.round(días/30)`; `valor_letras` con el port literal
de `enLetras()` del POC + `" PESOS M/CTE"`.

**Motor PDF** (`src/server/pdf/`, port del POC — no se lee el `.txt` para construirlo):
1. Cargar `assets/formatos/<docKey>.pdf` con `ignoreEncryption: true`.
2. **Deduplicar widgets de texto:** en cada `PDFTextField` con 2+ widgets, de `i` = último a 1, si
   algún `j < i` tiene rectángulo a menos de 3 pt en x, y, ancho y alto, quitar la referencia
   `Kids[i]` del `Annots` de **todas** las páginas y `acroField.removeWidget(i)` (corrige el texto
   doble de Mundo Mujer).
3. **Limpiar antes de llenar:** texto `setText(undefined)`, casilla `uncheck()`, radio y listas `clear()`.
4. **Aplicar** las filas de `mapping.json[docKey]` y luego las de `mapping.cuenta-pago.json[docKey]`:
   `t` texto (`fmt: "money"` → `formatoMiles`, p. ej. `50.000.000`, sin `$`, igual que el POC),
   `d` parte de fecha (`d`, `m`, `y` o `dd/mm/yyyy`), `c` marcar si `mismo(D[key], val)`, `x`
   marcar siempre, `s` texto literal, `tv` texto solo si `D[cond[0]] === cond[1]`, `ch` el carácter
   `i` de `String(D[key])` (vacío fuera de rango). **Marcar** = casilla `check()`, radio
   `select(primera opción)`, **campo de texto `setText("X")`**. Campo inexistente → `notFound`;
   valor vacío → no se toca; caracteres fuera de Latin-1 → `?`. `mismo()` compara sin mayúsculas,
   sin tildes, con `trim()` y con `o` final ≡ `a`.
5. `updateFieldAppearances(Helvetica)` y `save()`. Devuelve `{ bytes, reporte: { notFound, skipped, text, checks } }`.

**Catálogos y campos del asistente:** los valores de cada catálogo (`tipo_doc`, `tipo_cdt`,
`periodicidad`, `forma_pago`, `sexo`, `estado_civil`, `nivel_educ`, `tipo_vivienda`, `ocupacion`,
`contrato`, `declara_renta`, `cta_tipo`) y la tabla de claves por paso con sus obligatorias son los
de `docs/referencia/contratos.md` §6 y se materializan en `src/lib/datos/catalogos.ts` en el paso 9.
Obligatorias: entidad, valor, plazo_dias, fecha_apertura, tipo_cdt, forma_pago, ciudad, nombre1,
apellido1, tipo_doc, num_doc, celular, direccion, ciudad_res, periodicidad, cta_banco, cta_tipo,
cta_numero, cta_titular.

### Máquina de estados de la solicitud

Estados: `borrador`, `pendiente_validacion`, `devuelta`, `pendiente_firma`, `firma_en_revision`,
`lista_para_enviar`, `enviada_entidad`, `cdt_constituido`, `cancelada`. La tabla vive en
`src/server/solicitudes/estados.ts` (paso 9) y la ejecuta `ejecutarTransicion()` (paso 12).

| Acción | Desde | Hacia | Actor (además de `can()`) | Guarda y efectos |
|---|---|---|---|---|
| `enviar` | borrador, devuelta | pendiente_validacion | cliente dueño, asesor asignado, coordinador | Obligatorios válidos; el motor devuelve una condición; copia claves de perfil a `clientes.perfil` |
| `aprobar` | pendiente_validacion | pendiente_firma | asesor asignado, coordinador | `fecha_apertura` ≥ hoy; congela condiciones; versión 1; PDF por `doc_key` |
| `devolver` | pendiente_validacion | devuelta | asesor asignado, coordinador | `observacion` no vacía |
| `cargar_firma` | pendiente_firma | firma_en_revision | cliente dueño, asesor asignado, coordinador | Archivos válidos → un PDF `firmado` de la versión actual |
| `aceptar_firma` | firma_en_revision | lista_para_enviar | asesor asignado, coordinador | Firmado `vigente` de la versión actual → `aceptado` |
| `rechazar_firma` | firma_en_revision | pendiente_firma | asesor asignado, coordinador | `motivo` no vacío → firmado `rechazado` |
| `enviar_entidad` | lista_para_enviar | enviada_entidad | asesor asignado, coordinador | `fecha_envio` obligatoria, `radicado` opcional |
| `constituir` | enviada_entidad | cdt_constituido | asesor asignado, coordinador | Datos finales del CDT; crea `cdts` (`origen` solicitud); número repetido → `CONFLICTO` |
| `cancelar` | todos menos cdt_constituido y cancelada | cancelada | asesor asignado, coordinador | `motivo` no vacío |
| `editar_post_aprobacion` | pendiente_firma, firma_en_revision, lista_para_enviar, enviada_entidad | pendiente_firma | asesor asignado, coordinador | `motivo`; recalcula con la tabla vigente hoy; versión + 1; regenera PDFs; generados y firmados anteriores → `desactualizado`; diffs en auditoría |

Edición sin cambio de estado: cliente en `borrador` y `devuelta` (autoguardado); asesor y
coordinador en `borrador`, `devuelta` y `pendiente_validacion` **con motivo** (diffs en auditoría).
`cdt_constituido` y `cancelada` son finales. Toda transición escribe, en la misma transacción, una
fila de `solicitud_eventos` y una de `audit_events` (`accion` = `solicitud.<acción>`). Cualquier
combinación fuera de la tabla → 409 `TRANSICION_INVALIDA` sin escribir filas.

**Alerta de vigencia:** en `pendiente_firma`, `firma_en_revision` y `lista_para_enviar`, si
`condicion.vigente_hasta` < hoy, el detalle del asesor trae `alertaVigencia: true` y muestra
"La tasa aprobada perdió vigencia: edita la solicitud para tomar la tasa actual como nueva versión".

---

## 6. Frontend Architecture

### Routes

| Route | Page | Data source | Auth |
|---|---|---|---|
| `/` | Portada: «Abrir mi CDT» (→ `/registro`, destino del botón de corbanfc.com), «Ya tengo cuenta» (→ `/ingreso`), enlace discreto «Ingreso del equipo Corban» | estático | público |
| `/registro` | Registro (documento, nombres, correo, celular) → envío de OTP → código | `POST /api/v1/auth/registro` + cliente better-auth | público |
| `/ingreso` | Correo → código OTP | cliente better-auth | público |
| `/invitacion/[token]` | Invitación del asesor → OTP → aceptar | `/api/v1/auth/invitaciones/{token}` | público |
| `/consentimiento` | Texto Ley 1581 versión vigente + «Acepto» | `/api/v1/consentimiento` | cliente con sesión |
| `/ingreso-staff` | Botón «Entrar con Microsoft» (o aviso si Entra no está configurado) | cliente better-auth `signIn.social` | público |
| `/mi-cuenta` | Inicio: mis solicitudes (estado y siguiente paso) + resumen del portafolio | react-query → `/api/v1/solicitudes`, `/api/v1/portafolio` | cliente + consentimiento |
| `/mi-cuenta/solicitudes/nueva` | Elegir entidad y crear borrador → redirige al asistente | `POST /api/v1/solicitudes` | cliente + consentimiento |
| `/mi-cuenta/solicitudes/[id]/editar?paso=` | Asistente: CDT → Personal → Laboral → Financiera → Pago de intereses y cuenta → Resumen | `GET/PATCH /api/v1/solicitudes/{id}`, `/api/v1/condiciones/opciones` | cliente dueño, `borrador`/`devuelta` |
| `/mi-cuenta/solicitudes/[id]` | Detalle: línea de tiempo, observaciones, documentos, carga firmada | `/api/v1/solicitudes/{id}`, `/documentos`, `/firmados` | cliente dueño |
| `/mi-cuenta/portafolio` | CDT vigentes, total invertido, próximos vencimientos | `/api/v1/portafolio` | cliente |
| `/asesor` | Bandeja: `pendiente_validacion` y `firma_en_revision` primero | servidor (servicio de consultas) | asesor, coordinador |
| `/asesor/solicitudes` | Lista paginada en servidor, búsqueda y filtros | servidor (searchParams) | asesor, coordinador, gerencia, admin (lectura) |
| `/asesor/solicitudes/[id]` | Detalle: datos, línea de tiempo, versiones, documentos, notas, acciones por estado | servidor + server actions + `/api/staff/**` | según matriz |
| `/asesor/clientes` | Mis clientes, invitar cliente | servidor + server action | asesor, coordinador |
| `/coordinador/condiciones` | Pestañas Tasas · Entidades · Festivos con validación de solapes | servidor + server actions | coordinador (otros roles: lectura de tasas) |
| `/coordinador/importar` | Subir .xlsx → mapear columnas → vista previa → confirmar → resumen | `/api/staff/importaciones/**` | coordinador, admin |
| `/gerencia` | Reportes con filtros y exportación .xlsx | servidor + `/api/staff/reportes/**` | gerencia, coordinador |
| `/admin/staff` | Alta, rol y desactivación del staff | servidor + server actions | admin |

### Rendering strategy

- Todo lo autenticado es dinámico: cada página lee la sesión en el servidor (`getActor(await
  headers())` en Server Components) y nada se cachea entre usuarios. No se activa
  `cacheComponents`; ninguna página usa `"use cache"` (datos personales).
- `/` y `/ingreso-staff` son estáticas. Los route handlers exportan `dynamic = "force-dynamic"`
  cuando leen base o sesión.
- Área de cliente: Server Component para el layout (puerta de consentimiento) y para la lectura
  inicial; los pasos del asistente, el inicio y el portafolio son componentes cliente con
  react-query contra `/api/v1/**` — así la web ejercita a diario el contrato de la app móvil.
- Área de staff: Server Components que llaman servicios directamente (lectura) y server actions
  para mutaciones; `"use client"` solo en hojas interactivas (filtros, diálogos, gráficos).
- `proxy.ts` (Node runtime, Next 16) solo redirige peticiones de **páginas** sin cookie de sesión:
  `/mi-cuenta/**` → `/ingreso?siguiente=…`, `/asesor|coordinador|gerencia|admin/**` →
  `/ingreso-staff`. Su `matcher` excluye `/api/**`, `/_next/**` y archivos estáticos (así no
  bufferiza cargas de 15 MB). Nunca decide permisos.

### Component hierarchy

```
(cliente)/mi-cuenta/layout.tsx            [server] getActor → sin sesión: /ingreso · sin consentimiento: /consentimiento · staff: /asesor
└── ShellCliente                          [server] barra superior con logo, nombre, «Salir»; navegación inferior en móvil
    └── ProveedorConsultas                [client] QueryClientProvider (staleTime 30 s)
        └── solicitudes/[id]/editar/page.tsx  [server] valida dueño y estado editable
            └── Asistente                 [client] pasos, progreso, autoguardado por paso (PATCH)
                ├── PasoCdt               [client] tarjetas de entidad, valor, chips de plazo (de /opciones)
                ├── PasoFormulario        [client] react-hook-form + zodResolver del esquema del paso
                ├── PasoPagoIntereses     [client] periodicidades con su tasa + cuenta
                └── PasoResumen           [client] valor en letras y vencimiento estimados, «Enviar a validación»

(staff)/layout.tsx                        [server] getActor → solo staff activo; navegación según can()
└── ShellStaff                            [server] barra lateral navy (≥ 1024 px) / menú hoja (< 1024 px)
    └── asesor/solicitudes/[id]/page.tsx  [server] obtenerDetalleStaff(actor, id) → 404 si no puede ver
        ├── EncabezadoSolicitud           [server] código, estado, alerta de vigencia
        ├── LineaDeTiempo                 [server] solicitud_eventos
        ├── TablaDocumentos               [server] por versión, enlaces de descarga staff
        ├── PanelDatos                    [client] edición con motivo obligatorio (server action)
        └── AccionesPorEstado             [client] solo las acciones que permite la tabla de estados
```

### State management

- **Estado del servidor:** @tanstack/react-query en el área de cliente (claves
  `["solicitudes"]`, `["solicitud", id]`, `["opciones", entidad, valor, plazo]`, `["portafolio"]`;
  `staleTime` 30 s; invalidación tras cada mutación). En staff, el servidor es la fuente y
  `router.refresh()` tras cada server action.
- **Formularios:** react-hook-form + `zodResolver` con el esquema del paso de `src/lib/datos/`;
  el mismo esquema valida en el route handler.
- **Autoguardado:** al pulsar «Siguiente» o «Anterior» se hace `PATCH` del paso; además un
  guardado con *debounce* de 1,5 s mientras se escribe. Sin actualizaciones optimistas: el
  indicador «Guardado» aparece cuando el servidor responde 200.
- **Deliberadamente fuera de un store global:** sesión (la lee el servidor), datos de solicitudes
  (react-query), filtros del staff (en la URL como `searchParams`, recargables y compartibles).
  No se instala ninguna librería de store global.

### Loading, empty, and error states

| Superficie | Cargando | Vacío | Error |
|---|---|---|---|
| Mis solicitudes | 3 tarjetas `Skeleton` | «Aún no tienes solicitudes» + botón «Abrir un CDT» | Alerta «No pudimos cargar tus solicitudes» + «Reintentar» |
| Asistente (cada paso) | Campos deshabilitados + «Guardando…» | — | Error junto al campo (texto, no solo color) y resumen arriba con `role="alert"`; foco al primer campo inválido |
| Opciones de plazo/periodicidad | Chips `Skeleton` | «No hay plazos disponibles para este valor en esta entidad. Tu asesor te contactará.» | Mensaje con el código del error del motor |
| Documentos del cliente | Lista `Skeleton` | «Tus formatos aparecerán aquí cuando tu asesor apruebe la solicitud» | Alerta + reintentar |
| Portafolio | Tarjetas `Skeleton` | «Aún no tienes CDT constituidos» + «Abrir un CDT» | Alerta + reintentar |
| Bandeja / listados del staff | `loading.tsx` con filas `Skeleton` | «No hay solicitudes con estos filtros» + «Limpiar filtros» | `error.tsx` con request id |
| Reportes | `loading.tsx` | «Sin datos para el rango elegido» | `error.tsx` |
| Importación | Barra de progreso por bloque | «El archivo no tiene filas de datos» | Lista de errores por fila (fila, columna, motivo) |

---

## 7. Design System

Valores decididos (no se usó `ui-ux-pro-max`: la paleta y la tipografía las fijó el cliente en la
entrevista). Todos viven en `src/app/globals.css` (`@theme`), el único archivo a cambiar cuando
llegue la paleta oficial. Solo modo claro en v1.

### Colors

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-primary` | `#2E6DA4` | NOT APPLICABLE (solo claro en v1) | Botones primarios, enlaces, anillo de foco |
| `--color-primary-dark` | `#1F4E7A` | — | Hover/activo del primario |
| `--color-primary-foreground` | `#FFFFFF` | — | Texto sobre primario |
| `--color-background` | `#F5F6F7` | — | Fondo de página |
| `--color-card` | `#FFFFFF` | — | Tarjetas, paneles, diálogos (`--color-popover` igual) |
| `--color-border` | `#E2E4E7` | — | Divisores y bordes decorativos |
| `--color-input` | `#6B7178` | — | Borde de campos (≥ 3:1 sobre blanco) |
| `--color-foreground` | `#1B1F23` | — | Texto principal |
| `--color-muted-foreground` | `#6B7178` | — | Texto secundario, ayudas |
| `--color-destructive` | `#C0402C` | — | Errores, cancelar |
| `--color-success` | `#2F9E5B` | — | Íconos y bordes de éxito (no texto) |
| `--color-success-strong` | `#1E7A45` | — | Texto e insignias de éxito |
| `--color-navy` / `--color-navy-dark` | `#1D2226` / `#101317` | — | Barra lateral del staff, encabezado público |
| `--color-secondary` | `#E2E4E7` | — | Botón secundario (texto `#1B1F23`) |
| `--color-ring` | `#2E6DA4` | — | Foco visible |

**Contraste (WCAG 2.2 AA, calculado con la fórmula de luminancia relativa):** los tres pares más
justos son `#6B7178` sobre `#F5F6F7` = **4,56:1**, `#2E6DA4` sobre `#F5F6F7` = **5,06:1** y
`#C0402C` sobre `#F5F6F7` = **4,84:1**; todos ≥ 4,5. El verde decidido `#2F9E5B` da **3,41:1**
con blanco: sirve para íconos y bordes (≥ 3:1) pero **no** para texto, por eso se añadió
`--color-success-strong` `#1E7A45` (5,35:1 sobre blanco, 4,95:1 sobre `#F5F6F7`). Blanco sobre
`#2E6DA4` = 5,47:1; sobre navy = 16,0:1. El gris muted **no** se usa sobre navy (3,25:1): en la
barra lateral todo el texto es blanco. El paso 8 convierte esto en una prueba.

### Typography

| Role | Family | Size / line-height | Weight | Tracking |
|---|---|---|---|---|
| Display | Poppins | 32/40 px (móvil 28/36) | 700 | -0.01em |
| Heading | Poppins | h1 24/32 · h2 20/28 · h3 18/26 | 600 | 0 |
| Body | Inter | cliente 16/24 · staff 14/20 | 400 (énfasis 600) | 0 |
| Mono | `ui-monospace, SFMono-Regular, Menlo, monospace` | 13/20 (códigos SOL-000001, números de CDT) | 500 | 0 |

**Font loading:** autoalojadas con `next/font/local` desde `src/app/fonts/` —
`inter-latin.woff2` (rango de peso `100 900`) y `poppins500/600/700.woff2` (pesos 500, 600, 700),
`display: "swap"` en la llamada al loader, variables `--font-inter` y `--font-poppins` sobre `<html>`.
`inter-latin-ext.woff2` queda en disco sin cargar: el subconjunto latin ya cubre á, é, í, ó, ú, ñ,
ü, ¿ y ¡, y dos caras con los mismos descriptores sin `unicode-range` se pisarían. Respaldo
`ui-sans-serif, system-ui, sans-serif`. (El criterio de `display` se verifica en la llamada al
loader, no sobre el CSS construido: next/font genera caras de respaldo sin `font-display`.)

### Spacing, radius, elevation

- Espaciado: base 4 px — 4, 8, 12, 16, 24, 32, 48, 64 (escala de Tailwind 1, 2, 3, 4, 6, 8, 12, 16).
- Radio: 10 px (`--radius-lg`) en tarjetas, botones y campos; 6 px en insignias pequeñas; completo en avatares.
- Sombras: tarjeta `0 1px 2px rgb(16 19 23 / 0.06)` (`shadow-card`); diálogos y menús `0 8px 24px rgb(16 19 23 / 0.12)` (`shadow-popover`).
- Ancho máximo: cliente 640 px en formularios y 960 px en listas; staff 1280 px. Puntos de quiebre de Tailwind: 640, 768, 1024, 1280.
- Objetivos táctiles del cliente ≥ 44 × 44 px (`min-h-11`); staff ≥ 32 px con separación ≥ 8 px.

### Motion

Hover y foco 150 ms `ease-out`; diálogos y hojas 200 ms `ease-out` al entrar y 150 ms al salir;
sin animaciones decorativas. Toda animación lleva la variante `motion-reduce:transition-none` /
`motion-reduce:animate-none`. No se usa `emil-design-eng`: no hay transiciones con significado.

### Component style

Sobrio y financiero: superficies blancas sobre gris muy claro, un solo color de acción (azul
`#2E6DA4`), navy solo para la estructura del staff. El cliente ve tarjetas amplias, un paso por
pantalla y botones grandes; el staff ve tablas densas (filas de 40 px, texto 14 px) que bajo
768 px se convierten en tarjetas apiladas. Un componente nuevo encaja si usa solo tokens, no
introduce sombras más fuertes que `shadow-popover` y comunica estado con texto además de color.

---

## 8. Authentication & Authorization

### Provider and rationale

**better-auth** con el adaptador Drizzle es el único dueño de la sesión. El staff entra **solo**
con Microsoft Entra ID (proveedor social `microsoft` restringido al `tenantId` de Corban **y** a la
lista `staff_members`); los clientes entran **solo** con código de un solo uso por correo (plugin
`emailOTP`). Se eligió sobre Clerk/Entra External ID porque los usuarios y sesiones quedan en la
base propia en Azure (datos financieros bajo la Ley 1581), sin costo por usuario, y un solo
mecanismo cubre a ambos públicos.

Configuración (`src/server/auth/auth.ts`, perezosa vía `getAuth()`, nunca al importar):
`database: drizzleAdapter(getDb(), { provider: "pg", schema: { user, session, account, verification } })`,
`baseURL` y `trustedOrigins` = `[BETTER_AUTH_URL]`, `secret` = `BETTER_AUTH_SECRET` (≥ 32
caracteres o `getAuth()` lanza error que nombra la variable), `rateLimit: { enabled: false }`
(los límites son los de §5), `session: { expiresIn: 7 días, updateAge: 1 día }`,
`plugins: [emailOTP({ otpLength: 6, expiresIn: 600, allowedAttempts: 5, disableSignUp: false, sendVerificationOTP })]`,
y `socialProviders.microsoft = { clientId, clientSecret, tenantId, prompt: "select_account" }`
**solo si** `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` y `ENTRA_TENANT_ID` están todas definidas.
Las claves `clientId`/`clientSecret`/`tenantId` del proveedor Microsoft **no se verificaron** en
la sesión de diseño (verificar contra los tipos instalados de better-auth 1.7.16 antes de
escribirlas: `pnpm typecheck` falla si una clave no existe). Imports usados, verificados en el
`package.json` de better-auth: `better-auth`, `better-auth/adapters/drizzle`,
`better-auth/plugins/email-otp` (o `better-auth/plugins`). Cliente del navegador:
`better-auth/react` (`createAuthClient` + `emailOTPClient`), verificar export al instalar.

### Flows

**Cliente — registro propio (botón de corbanfc.com):** `/registro` → `POST /api/v1/auth/registro`
crea el cliente → la UI pide el OTP (`authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" })`)
→ el cliente escribe los 6 dígitos (`authClient.signIn.emailOtp`) → sesión → `getActor()` enlaza
`clientes.user_id` → `/mi-cuenta` → el layout ve que no hay consentimiento → `/consentimiento` →
«Acepto» (`POST /api/v1/consentimiento`) → `/mi-cuenta`. Fallas: documento existente con otro
correo → 409 «Contacta a tu asesor»; código incorrecto → mensaje y nuevo intento (máx. 5 por
código, luego hay que pedir uno nuevo); 6.º envío en 15 min → 429 con `Retry-After`.

**Cliente — invitación del asesor:** el asesor (en `/asesor/clientes`) crea el cliente (documento,
nombre, correo) y la invitación (token aleatorio de 32 bytes, se guarda su SHA-256, vence en 7
días) → correo `invitacion` con `/invitacion/<token>` → el cliente valida el token, hace OTP con
el correo de la invitación → `POST …/aceptar` fija `accepted_at` y `clientes.asesor_id` →
consentimiento → `/mi-cuenta`. Token usado, vencido o inexistente → 410 `INVITACION_INVALIDA`
(«Pide a tu asesor una nueva invitación»).

**Cliente — ingreso:** `/ingreso` → correo → OTP → `/mi-cuenta` (o `siguiente`). Un correo sin
cliente asociado entra pero `/mi-cuenta` muestra «Completa tu registro» (`PERFIL_REQUERIDO`).

**Staff:** `/ingreso-staff` → «Entrar con Microsoft» → Entra (tenant de Corban) →
`/api/auth/callback/microsoft` → el hook `databaseHooks.session.create.before`
(`antesDeCrearSesion()`) busca la cuenta `microsoft` del usuario y exige un `staff_members`
**activo** con ese correo; si no, devuelve `false` y no se crea sesión (la UI muestra «Tu cuenta no
está habilitada en Corban CDT»). Primer ingreso exitoso: enlaza `staff_members.user_id`. Un correo
de staff que pide OTP recibe 403 `USAR_MICROSOFT`. Sesiones de staff con más de 12 h desde
`created_at` se rechazan en `getActor()` (nuevo ingreso).

**Local y E2E (Entra no corre en local):** `POST /api/test/login { email }` existe solo si
`NODE_ENV !== "production"` **y** `AUTH_TEST_LOGIN=1`; para un staff activo ejecuta en el servidor
`auth.api.sendVerificationOTP` + `auth.api.signInEmailOTP` (el OTP se toma de un mapa en memoria
que solo se llena fuera de producción) y devuelve la respuesta con `set-cookie`. En cualquier
otro caso responde 404 `NO_ENCONTRADO`. El paso 19 prueba el 404 contra la build de producción.

**Expiración y salida:** sesión de 7 días renovada cada día de uso (cliente), 12 h máximo (staff);
«Salir» llama `authClient.signOut()` y borra la cookie. Desactivar un staff borra todas sus filas
de `session`. **Borrado de cuenta del cliente:** no es autoservicio en v1; el coordinador marca
`clientes.deleted_at` a pedido del titular (derecho de supresión Ley 1581) y la política de
retención la fija el área legal (lista de lanzamiento).

### Route protection

| Surface | Rule | Enforced where |
|---|---|---|
| `/mi-cuenta/**` | sesión de cliente, `clientes` enlazado y consentimiento vigente | `src/app/(cliente)/mi-cuenta/layout.tsx` (redirección) + cada servicio (`CONSENTIMIENTO_REQUERIDO`) |
| `/asesor/**`, `/coordinador/**`, `/gerencia/**`, `/admin/**` | staff activo; cada página verifica `can()` de su acción | `src/app/(staff)/layout.tsx` + la página + el servicio |
| `/api/v1/**` | sesión de cliente; recurso propio; consentimiento | cada handler: `getActor(request.headers)` → servicio con `can()` |
| `/api/staff/**` | staff activo con la acción de la matriz | cada handler → servicio con `can()` |
| `/api/test/login` | `NODE_ENV≠production` y `AUTH_TEST_LOGIN=1`, si no 404 | `src/app/api/test/login/route.ts` |
| Server actions del staff | igual que su página | dentro de cada acción (las server actions son POST a la ruta: el proxy no las protege) |
| Redirección gruesa sin cookie | solo comodidad de navegación | `src/proxy.ts` |

**Regla de aplicación:** la autorización se comprueba en el servidor en cada petición, antes del
trabajo. Las guardas de cliente y los botones ocultos son cosméticos.

### Roles and permissions

| Rol | Puede | No puede |
|---|---|---|
| cliente | Ver y editar sus solicitudes en `borrador`/`devuelta`, enviarlas, descargar sus PDF, subir su firma, ver su portafolio | Ver datos de otros clientes, aprobar, ver condiciones internas, nada del staff |
| asesor | Sobre sus clientes asignados: ver, crear, editar con motivo, enviar, aprobar, devolver, cancelar, revisar firmas, enviar a la entidad, constituir; invitar clientes | Ver clientes no asignados (404), reasignar, administrar tasas o festivos, importar, reportes, staff |
| coordinador | Todo lo del asesor sobre **todos** los clientes; reasignar; administrar condiciones, entidades y festivos; importar Excel; reportes | Administrar el staff |
| gerencia | Ver solicitudes y portafolio de todos (solo lectura), reportes y exportación | Cualquier escritura, descargar documentos de clientes |
| admin | Administrar el staff; ver solicitudes, clientes y documentos; importar Excel | Acciones del flujo (aprobar, editar…), administrar tasas, reportes |

Matriz exacta que implementa `can(actor, accion, recurso)` (`src/server/authz/matriz.ts`) y que
`tests/unit/authz.test.ts` reproduce celda por celda como tabla esperada propia. Alcance:
**propio** = `recurso.clienteId === actor.clienteId`; **asignado** = `recurso.asesorId === actor.staffId`;
**todos** = sin filtro; "—" = denegado.

| Acción | cliente | asesor | coordinador | gerencia | admin |
|---|---|---|---|---|---|
| `solicitud.ver` | propio | asignado | todos | todos | todos |
| `solicitud.crear` | propio | asignado | todos | — | — |
| `solicitud.editar` | propio | asignado | todos | — | — |
| `solicitud.enviar` | propio | asignado | todos | — | — |
| `solicitud.aprobar` | — | asignado | todos | — | — |
| `solicitud.devolver` | — | asignado | todos | — | — |
| `solicitud.cancelar` | — | asignado | todos | — | — |
| `solicitud.cargar_firma` | propio | asignado | todos | — | — |
| `solicitud.revisar_firma` | — | asignado | todos | — | — |
| `solicitud.enviar_entidad` | — | asignado | todos | — | — |
| `solicitud.constituir` | — | asignado | todos | — | — |
| `solicitud.reasignar` | — | — | todos | — | — |
| `documento.descargar` | propio | asignado | todos | — | todos |
| `cliente.ver` | propio | asignado | todos | — | todos |
| `cliente.invitar` | — | sí | sí | — | — |
| `cliente.reasignar` | — | — | sí | — | — |
| `portafolio.ver` | propio | asignado | todos | todos | todos |
| `condiciones.ver` | sí | sí | sí | sí | sí |
| `condiciones.administrar` | — | — | sí | — | — |
| `festivos.administrar` | — | — | sí | — | — |
| `importacion.ejecutar` | — | — | sí | — | sí |
| `reportes.ver` | — | — | sí | sí | — |
| `staff.administrar` | — | — | — | — | sí |

Si `can()` deniega una acción `*.ver`, el servicio responde `NO_ENCONTRADO` (404); si el actor ve
el recurso pero no puede la acción, `PROHIBIDO` (403). Las guardas de estado de §5 se evalúan
después de `can()`.

### Sessions

Cookie opaca de better-auth (`better-auth.session_token`, valor firmado; fila en `session`):
`HttpOnly`, `SameSite=Lax`, `Secure` en producción (HTTPS), `Path=/`. Vida: 7 días con
renovación diaria (clientes), 12 h desde la creación (staff, verificado en `getActor()`).
**CSRF:** better-auth valida `Origin` contra `trustedOrigins` en sus POST; los route handlers
propios que mutan (`/api/v1/**`, `/api/staff/**`) rechazan con 403 `PROHIBIDO` una petición cuyo
`Origin` exista y no sea `BETTER_AUTH_URL` (`exigirMismoOrigen()` en
`src/server/authz/respuestas.ts`); las server actions tienen la verificación de origen de Next. La
futura app móvil usará el plugin `bearer` de better-auth sin cambiar `/api/v1`.

### Multi-tenancy / row-level isolation

Una sola organización (Corban); el aislamiento es **por cliente** y **por asesor asignado**. El
mecanismo es obligatorio en la capa de datos, no una costumbre: cada función de consulta de
`src/server/**` recibe el `actor` y aplica `filtroVisibilidad(actor)` —cliente:
`solicitudes.cliente_id = actor.clienteId`; asesor: `solicitudes.asesor_id = actor.staffId` (y
`clientes.asesor_id` para clientes); coordinador, gerencia y admin: sin filtro— **dentro del
`WHERE`**, de modo que un id ajeno simplemente no existe (404). Las mutaciones cargan el recurso
con el mismo filtro antes de `can()`. `tests/integration/aislamiento.test.ts` (paso 9) lo prueba
por API y por servicio. No se usa RLS de Postgres en v1: la app usa un solo rol de base de datos
y el filtro centralizado está probado; RLS queda como endurecimiento si se abre acceso directo.

---

## 9. BUILD ORDER

**Esta es la sección para la que existe el blueprint.** Un constructor que sigue §9 al pie de la
letra y se detiene cuando cada gate está en verde entrega el proyecto.

### The rules of a step

1. **Una sesión por paso.** Máximo 5 entradas en *Files touched* (se permiten globs de un
   directorio de la feature) y 2–6 criterios de aceptación.
2. **Cuatro campos siempre:** `Do`, `Done when`, `Verify`, `Checkpoint`, en ese orden de ejecución.
3. **"Done when" en forma EARS** (WHEN … THE SYSTEM SHALL …), observable y decidible por un comando.
4. Prohibido "se ve bien", "funciona", "está implementado".
5. **`Verify` es shell literal** que sale 0 cuando el paso es correcto, también bajo `set -e`.
   Un resultado esperado no cero se escribe `status=0; cmd || status=$?; test "$status" -eq N`.
6. Un paso no está terminado hasta que pasan su `Verify` **y** los de todos los pasos anteriores.
7. **Checkpoint en cada paso:** commit + `git tag step-NN-<slug>`. Si un paso sale mal:
   `git reset --hard step-<NN-1>-<slug-anterior>` y reintentar; nunca depurar hacia adelante.
8. **Nunca saltar.** Si el paso 7 se bloquea, detente y reporta.
9. **Ningún paso rompe un gate anterior.** Las variables de entorno se exigen desde el paso que
   indica la columna "Requerida desde el paso" de §10 y lo hace el módulo que las usa (no
   `env.ts`), así los `build`/`test` anteriores siguen en verde.
10. **No se afirman conteos no contados.** Los gates afirman propiedades ("cada tabla exportada por
    `schema.ts` existe", "0 fallidas"); los únicos números son invariantes del dominio (4
    entidades sembradas, 25 filas por página sobre 60 sembradas en la prueba).
11. **Ningún `Verify` depende de su propio Checkpoint:** nada de `git status`, `git ls-files` ni
    tags del mismo paso; esas aserciones van en el bloque Checkpoint o en §20.1.
12. **Cada paso termina su `Do` con `pnpm format`** (Biome `check --write`) para reconciliar el
    formato antes del `Verify`.
13. Los servicios necesarios para un `Verify` se levantan dentro del propio `Verify`
    (`docker compose up -d --wait postgres` es idempotente).
14. **El primer paso que produce algo ejecutable lo ejecuta:** el paso 1 arranca
    `.next/standalone/server.js` y consulta `/api/health`; el 18 consulta el manifiesto servido;
    el 20 arranca la imagen Docker.

### One step, one unit — the counting rule

> **Un paso de §9 = una tarea de `tasks.json` = un bloque de tarea en un epic.**

Este build tiene **20 pasos**, por encima del rango recomendado de 10–18: el número lo fijó el
usuario al confirmar la arquitectura (Gate B) y se mantiene; cada paso cabe en una sesión. Con 20
pasos y 5–9 pasos por epic, los epics legales son entre 3 y 4; se usan **3**:
`01-fundaciones` (pasos 1–7), `02-solicitudes` (pasos 8–14) y `03-operacion` (pasos 15–20).

### Step map

| # | Step | Depends on | Touches | Gate |
|---|---|---|---|---|
| 1 | Andamiaje y cadena de herramientas | — | `README.md`, `pnpm-lock.yaml` | `sh scripts/smoke-standalone.sh /api/health '"status":"ok"'` |
| 2 | Servicios locales, entorno y cliente de BD | 1 | `src/server/db/schema.ts`, `src/server/db/client.ts`, `src/app/api/health/db/route.ts`, `tests/integration/db.test.ts`, `drizzle/**` | `sh scripts/smoke-standalone.sh /api/health/db '"db":"ok"'` |
| 3 | Esquema completo, auditoría inmutable y semilla | 2 | `src/server/db/schema.ts`, `src/server/db/seed-base.ts`, `scripts/seed.ts`, `tests/integration/esquema.test.ts`, `drizzle/**` | `pnpm test tests/integration/esquema.test.ts` |
| 4 | Autorización can(), auditoría transaccional y logger | 3 | `src/server/authz/**`, `src/server/auditoria/**`, `src/lib/logger.ts`, `tests/unit/authz.test.ts`, `tests/integration/trazabilidad.test.ts` | `pnpm test tests/unit/authz.test.ts` |
| 5 | Autenticación del staff (Entra, lista blanca, test-login) | 4 | `src/server/auth/**`, `src/server/correo/**`, `src/app/api/auth/[...all]/route.ts`, `src/app/api/test/login/route.ts`, `tests/integration/auth-staff.test.ts` | `pnpm test tests/integration/auth-staff.test.ts` |
| 6 | Autenticación de clientes: registro, OTP, invitaciones y consentimiento | 5 | `src/server/clientes/acceso/**`, `src/app/api/v1/**`, `src/app/(publico)/**`, `src/proxy.ts`, `tests/integration/auth-clientes.test.ts` | `pnpm test tests/integration/auth-clientes.test.ts` |
| 7 | Condiciones de tasa, festivos y motor de cálculo | 6 | `src/server/condiciones/**`, `src/app/(staff)/coordinador/**`, `tests/helpers/fabricas.ts`, `tests/unit/motor-calculo.test.ts`, `tests/integration/condiciones.test.ts` | `pnpm test tests/unit/motor-calculo.test.ts` |
| 8 | Sistema de diseño y shells | 6, 7 | `src/app/globals.css`, `src/app/**/layout.tsx`, `src/components/**`, `tests/unit/contraste.test.ts`, `tests/e2e/responsive.spec.ts` | `pnpm e2e tests/e2e/responsive.spec.ts` |
| 9 | API v1 del cliente: perfil, solicitudes, borrador y envío | 6, 7 | `src/server/solicitudes/**`, `src/lib/datos/**`, `src/app/api/v1/**`, `tests/integration/api-v1.test.ts`, `tests/integration/aislamiento.test.ts` | `pnpm test tests/integration/aislamiento.test.ts` |
| 10 | Asistente del cliente (mobile-first) | 8, 9 | `src/app/(cliente)/mi-cuenta/**`, `src/components/cliente/**`, `tests/e2e/apoyo.ts`, `tests/e2e/asistente.spec.ts`, `tests/e2e/responsive.spec.ts` | `pnpm e2e tests/e2e/asistente.spec.ts` |
| 11 | Motor PDF y pruebas golden de los 6 formatos | 7, 9 | `src/server/pdf/**`, `tests/fixtures/cliente-ejemplo.json`, `tests/unit/pdf-mapeo.test.ts`, `tests/unit/pdf-golden.test.ts`, `tests/unit/__snapshots__/**` | `pnpm test tests/unit/pdf-golden.test.ts` |
| 12 | Máquina de estados, validación del asesor y PDFs versionados | 9, 11 | `src/server/solicitudes/**`, `src/server/almacenamiento/**`, `src/app/api/staff/solicitudes/**`, `src/app/api/v1/solicitudes/**`, `tests/integration/estados.test.ts` | `pnpm test tests/integration/estados.test.ts` |
| 13 | Carga del documento firmado y revisión | 10, 12 | `src/server/firmas/**`, `src/app/api/v1/solicitudes/**`, `src/app/api/staff/solicitudes/**`, `src/components/cliente/**`, `tests/integration/firmas.test.ts` | `pnpm test tests/integration/firmas.test.ts` |
| 14 | Espacio de trabajo del asesor | 13 | `src/server/solicitudes/**`, `src/app/(staff)/asesor/**`, `src/components/staff/**`, `tests/integration/asesor.test.ts` | `pnpm test tests/integration/asesor.test.ts` |
| 15 | Envío a la entidad, constitución y portafolio | 14 | `src/server/portafolio/**`, `src/app/(staff)/asesor/**`, `src/app/(cliente)/mi-cuenta/**`, `src/app/api/v1/**`, `tests/integration/portafolio.test.ts` | `pnpm test tests/integration/portafolio.test.ts` |
| 16 | Importación desde Excel | 15 | `src/server/importacion/**`, `src/app/(staff)/coordinador/importar/**`, `src/app/api/staff/importaciones/**`, `tests/integration/importacion.test.ts` | `pnpm test tests/integration/importacion.test.ts` |
| 17 | Reportes de gerencia y exportación | 15 | `src/server/reportes/**`, `src/app/(staff)/gerencia/**`, `src/app/api/staff/reportes/**`, `src/components/staff/**`, `tests/integration/reportes.test.ts` | `pnpm test tests/integration/reportes.test.ts` |
| 18 | Notificaciones, PWA y administración del staff | 17 | `src/server/solicitudes/notificaciones.ts`, `src/app/(staff)/admin/**`, `src/app/manifest.ts`, `src/app/iconos/[tamano]/route.tsx`, `tests/integration/notificaciones.test.ts` | `sh scripts/smoke-standalone.sh /manifest.webmanifest /mi-cuenta` |
| 19 | Endurecimiento y E2E de los 4 flujos | 16, 18 | `next.config.ts`, `tests/e2e/flujos.spec.ts`, `tests/e2e/responsive.spec.ts`, `tests/e2e/apoyo.ts`, `tests/integration/endurecimiento.test.ts` | `pnpm e2e tests/e2e/flujos.spec.ts` |
| 20 | Contenedor, CI y lista de lanzamiento | 19 | `Dockerfile`, `.dockerignore`, `scripts/smoke-docker.sh`, `docs/lanzamiento.md`, `tests/unit/ci.test.ts` | `sh scripts/smoke-docker.sh` |

El orden es lineal en la práctica (cada paso extiende archivos de los anteriores); las dependencias
reales permiten correr el paso 11 en paralelo con el 10 porque solo toca `src/server/pdf/**` y sus
pruebas (usa `en-letras.ts` del paso 7 y `catalogos.ts` del paso 9). Los archivos de infraestructura de los gates (configs, `scripts/*.sh`, `tests/setup.ts`,
`tests/e2e/preparar.ts`, CI) no aparecen en *Touches*: llegan con `workspace/` (§19.6).

---

#### Step 1 — Andamiaje y cadena de herramientas

**Do**
Bootstrap (§10) ya dejó en la raíz todo `workspace/` (manifiesto, configs, `/api/health`, la
portada mínima y `tests/unit/health.test.ts`) y `pnpm-lock.yaml`. Este paso hace verdes los gates
de la cadena de herramientas y fija el lockfile. Archivos:
- `README.md` — nuevo, en español: qué es, requisitos (§10 Prerequisites), "Bootstrap:
  `sh scripts/bootstrap.sh`", tabla de comandos (copia de la de `CLAUDE.md`).
- `pnpm-lock.yaml` — generado por el `pnpm install` de Bootstrap; se commitea aquí y desde
  entonces CI usa `--frozen-lockfile`.
- Ejecutar `pnpm format` una vez para reconciliar los archivos emitidos con Biome.
- `next build` puede reescribir `tsconfig.json` (por ejemplo `include` o `jsx`) y crear
  `next-env.d.ts`: es esperado; `tsconfig.json` está excluido de Biome y `next-env.d.ts` está en
  `.gitignore`.

**Done when**
- [ ] WHEN `pnpm lint` se ejecuta desde la raíz con el bundle presente en `blueprints/corban-portal-cdt/` THE SYSTEM SHALL terminar con código 0.
- [ ] WHEN `pnpm typecheck` se ejecuta THE SYSTEM SHALL terminar con código 0 sin errores.
- [ ] WHEN `pnpm test` se ejecuta THE SYSTEM SHALL pasar `tests/unit/health.test.ts` con 0 pruebas fallidas y terminar con código 0.
- [ ] WHEN `pnpm build` se ejecuta THE SYSTEM SHALL terminar con código 0 y producir `.next/standalone/server.js`.
- [ ] WHEN `sh scripts/smoke-standalone.sh` arranca `.next/standalone/server.js` en el puerto 3100 y pide `GET /api/health` THE SYSTEM SHALL responder 200 con un cuerpo JSON cuyo campo `status` vale `ok`.

**Verify**
```bash
pnpm lint                                   # expect: exit 0
pnpm typecheck                              # expect: exit 0
pnpm test                                   # expect: exit 0, 0 failed
pnpm build                                  # expect: exit 0
test -f .next/standalone/server.js          # expect: exit 0 — la ruta que usan el smoke y el Dockerfile
sh scripts/smoke-standalone.sh /api/health '"status":"ok"'   # expect: exit 0 — EJECUTA el servidor construido
```

**Checkpoint**
```bash
git add -A && git commit -m "step 1: andamiaje y cadena de herramientas"
git tag step-01-andamiaje
git ls-files --error-unmatch pnpm-lock.yaml   # expect: exit 0 — commiteado una línea arriba
```

---

#### Step 2 — Servicios locales, entorno y cliente de BD

**Do**
`docker-compose.yml`, `.env.example` (copiado a `.env` por Bootstrap), `src/lib/env.ts`,
`drizzle.config.ts`, `scripts/migrate.ts` y `scripts/db-test-prepare.ts` ya existen (workspace).
Este paso conecta la app a Postgres. Archivos:
- `src/server/db/schema.ts` — solo `festivos` (el bloque exacto de §4):
  ```ts
  import { date, pgTable, text, timestamp } from "drizzle-orm/pg-core";

  export const festivos = pgTable("festivos", {
    fecha: date("fecha", { mode: "string" }).primaryKey(),
    nombre: text("nombre").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
  ```
- `src/server/db/client.ts` — único punto de conexión, perezoso:
  ```ts
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
- `src/app/api/health/db/route.ts` — `export const dynamic = "force-dynamic"`; `GET` ejecuta
  `select 1` con `getDb().execute(…)` (plantilla `sql` de `drizzle-orm`) y responde
  `{ status: "ok", db: "ok" }`; si falla, 503 `{ status: "error", db: "error" }` (sin detalle del
  error en la respuesta).
- `tests/integration/db.test.ts` — tres pruebas: `getEnv().DATABASE_URL` termina en
  `/corban_test` y `select 1` devuelve una fila; insertar (`onConflictDoNothing`) y leer el festivo
  `2099-12-31` "Festivo de prueba"; quitar `DATABASE_URL` con
  `Reflect.deleteProperty(process.env, "DATABASE_URL")`, `reiniciarEnvParaPruebas()` y esperar que
  `getEnv()` lance un error que coincida con `/DATABASE_URL/` (restaurar en `finally`). `afterAll`
  llama `cerrarDb()`.
- La migración que emite `pnpm db:generate` para `festivos` (nombre elegido por drizzle-kit, en
  `drizzle/` junto con `drizzle/meta/`). Ejecutar `pnpm db:generate` con Postgres levantado o no:
  `generate` no se conecta.
- `pnpm format`.

**Done when**
- [ ] WHEN `docker compose up -d --wait postgres` se ejecuta THE SYSTEM SHALL terminar con código 0 solo después de que el healthcheck `pg_isready` del servicio `postgres` reporte saludable.
- [ ] WHEN `pnpm db:migrate` se ejecuta dos veces seguidas contra `DATABASE_URL` THE SYSTEM SHALL terminar con código 0 ambas veces y la tabla `festivos` SHALL existir.
- [ ] WHEN `pnpm db:test:prepare` se ejecuta THE SYSTEM SHALL recrear la base `corban_test` con todas las migraciones aplicadas y terminar con código 0.
- [ ] WHEN `pnpm test tests/integration/db.test.ts` se ejecuta THE SYSTEM SHALL ejecutar `select 1` mediante `getDb()` contra `corban_test`, insertar y leer una fila de `festivos`, y terminar con código 0.
- [ ] WHEN `DATABASE_URL` no está definida y se llama `getEnv()` THE SYSTEM SHALL lanzar un error cuyo mensaje nombra `DATABASE_URL`.
- [ ] WHEN el servidor standalone construido por `pnpm build` recibe `GET /api/health/db` THE SYSTEM SHALL responder 200 con un cuerpo JSON cuyo campo `db` vale `ok`.

**Verify**
```bash
docker compose up -d --wait postgres        # expect: exit 0 con postgres healthy
pnpm db:migrate                             # expect: exit 0
pnpm db:migrate                             # expect: exit 0 — idempotente
docker compose exec -T postgres psql -U corban -d corban -tAc "select to_regclass('public.festivos') is not null" | grep -qx t
                                            # expect: exit 0 — la tabla existe
pnpm db:test:prepare                        # expect: exit 0
pnpm test tests/integration/db.test.ts      # expect: exit 0, 0 failed
pnpm typecheck                              # expect: exit 0
pnpm lint                                   # expect: exit 0
pnpm build                                  # expect: exit 0
sh scripts/smoke-standalone.sh /api/health/db '"db":"ok"'    # expect: exit 0 — servidor real contra Postgres real
```

**Checkpoint**
```bash
git add -A && git commit -m "step 2: servicios locales, entorno y cliente de bd"
git tag step-02-base-datos
```

---

#### Step 3 — Esquema completo, auditoría inmutable y semilla

**Do**
Archivos:
- `src/server/db/schema.ts` — reemplazar por el esquema completo de §4 (idéntico a
  `docs/referencia/esquema.ts.txt`). `festivos` no cambia, así `drizzle-kit generate` no pregunta
  por renombres.
- La migración que emite `pnpm db:generate` para las tablas nuevas, y después la migración vacía
  que crea `pnpm db:generate --custom --name=auditoria_inmutable` (la más nueva de `drizzle/`), en
  la que se escribe el SQL del trigger de §4 *Migrations* tal cual.
- `src/server/db/seed-base.ts` — `export async function sembrarBase(db: Db, opciones: { adminEmail: string; demo: boolean }): Promise<void>` con los datos de §4 *Seed data*:
  `insert(entidades).values(ENTIDADES_BASE).onConflictDoNothing()`; admin con el correo en
  minúsculas, `onConflictDoNothing()`; con `demo`, por cada entidad sin condiciones, las 5 filas
  DEMO (90/vencimiento 9.5000 · 180/vencimiento 10.0000 · 180/mensual 9.8000 · 360/vencimiento
  10.5000 · 360/mensual 10.3000; `monto_min` 1000000; `monto_max` nulo; desde 2026-01-01).
  Importa `type Db` de `./client.ts` y las tablas de `./schema.ts`.
- `scripts/seed.ts` — lee `ADMIN_EMAIL` (sin ella lanza error), `--demo` desde `process.argv`,
  llama `sembrarBase(getDb(), …)` y `cerrarDb()`; patrón `main().catch(…process.exit(1))` (sin
  top-level await: tsx ejecuta los `.ts` como CommonJS en este proyecto). Importa con el alias:
  `@/server/db/client`, `@/server/db/seed-base`.
- `tests/integration/esquema.test.ts`:
  1. Para cada valor exportado por `@/server/db/schema` que cumpla `is(valor, PgTable)`
     (`is`, `getTableName` de `drizzle-orm`; `PgTable` de `drizzle-orm/pg-core`), `select
     to_regclass('public."' || nombre || '"') is not null` devuelve `true`.
  2. Insertar una fila en `audit_events`; `update`, `delete` y `truncate` sobre ella fallan con
     SQLSTATE `42501`. Drizzle 0.45 envuelve los errores del driver: leer el código con
     `(error.cause ?? error).code`.
  3. `sembrarBase` dos veces con `admin.prueba@corbanfc.com` → `entidades` tiene exactamente las 4
     claves y hay exactamente 1 `staff_members` activo `admin` con ese correo.
  4. Dos `clientes` con el mismo (`tipo_doc`, `num_doc`) → el segundo falla con `23505`.
  5. Una solicitud insertada sin `codigo` tiene `codigo` que cumple `/^SOL-\d{6}$/`.
- `pnpm format`.

**Done when**
- [ ] WHEN `pnpm db:migrate` se ejecuta sobre la base del paso 2 THE SYSTEM SHALL terminar con código 0 y cada tabla exportada por `src/server/db/schema.ts` SHALL existir en `corban_test` después de `pnpm db:test:prepare`.
- [ ] WHEN se intenta `UPDATE`, `DELETE` o `TRUNCATE` sobre `audit_events` THE SYSTEM SHALL fallar con el código SQLSTATE `42501` y dejar la fila sin cambios.
- [ ] WHEN `pnpm db:seed` se ejecuta dos veces THE SYSTEM SHALL terminar con código 0 ambas veces y dejar exactamente 4 filas en `entidades` (`ban100`, `colte`, `juris`, `mmujer`) y exactamente una fila activa en `staff_members` con rol `admin` para `ADMIN_EMAIL`.
- [ ] WHEN se insertan dos `clientes` con el mismo par (`tipo_doc`, `num_doc`) THE SYSTEM SHALL rechazar el segundo con violación de unicidad (SQLSTATE `23505`).
- [ ] WHEN se inserta una solicitud sin `codigo` THE SYSTEM SHALL asignarle un código que cumple `^SOL-\d{6}$`.

**Verify**
```bash
docker compose up -d --wait postgres        # expect: exit 0
pnpm db:migrate                             # expect: exit 0
pnpm db:seed                                # expect: exit 0
pnpm db:seed                                # expect: exit 0 — idempotente
docker compose exec -T postgres psql -U corban -d corban -tAc "select count(*) from entidades" | grep -qx 4
                                            # expect: exit 0 — invariante de la semilla
pnpm db:test:prepare                        # expect: exit 0
pnpm test tests/integration/esquema.test.ts # expect: exit 0, 0 failed
pnpm typecheck                              # expect: exit 0
pnpm lint                                   # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 3: esquema completo, auditoria inmutable y semilla"
git tag step-03-esquema
```

---

#### Step 4 — Autorización can(), auditoría transaccional y logger

**Do**
Archivos:
- `src/server/authz/**` — `actor.ts` (tipo `Actor` = `{ tipo: "staff"; userId; staffId; rol; email }`
  | `{ tipo: "cliente"; userId; clienteId: string | null; email; consentimiento: boolean }`);
  `matriz.ts` (la matriz de §8 como datos: acción → por rol `"propio" | "asignado" | "todos" | "si" | null`);
  `can.ts` (`can(actor, accion, recurso?: { clienteId?: string | null; asesorId?: string | null }): boolean`,
  cliente sin consentimiento → `false` salvo `condiciones.ver`); `errores.ts` (`class ErrorDominio`
  con `code`, `message`, `fields?` y el mapa código → HTTP de §5); `respuestas.ts` (`ok(data, init?)`,
  `respuestaError(error)`, `leerCuerpo(request, esquemaZod)`, `exigirMismoOrigen(request)`).
- `src/server/auditoria/**` — `conAuditoria(evento, trabajo)`:
  `getDb().transaction(async (tx) => { const r = await trabajo(tx); await tx.insert(auditEvents).values({...evento}); return r; })`;
  `evento` = `{ actorId, actorIp, accion, targetType, targetId, metadata }`. Export del tipo `Tx`.
- `src/lib/logger.ts` — `log.debug/info/warn/error(mensaje, datos?)` escribe una línea JSON en
  stdout (`nivel`, `mensaje`, `ts`, `requestId`, `actorId` y `datos` redactados); respeta
  `LOG_LEVEL`; redacta recursivamente las claves `num_doc`, `numDoc`, `email`, `celular`,
  `tel_fijo`, `tel_trab`, `direccion`, `cta_numero`, `ctaNumero`, `otp`, `token`, `password`,
  `cookie`, `authorization` → `"[REDACTADO]"`. `requestIdDe(headers)` usa `x-request-id` o
  `crypto.randomUUID()`.
- `tests/unit/authz.test.ts` — tabla esperada **escrita en la prueba** (copia de la matriz de §8,
  no importada de `matriz.ts`) recorrida celda por celda con actores y recursos propios/ajenos/
  asignados/no asignados; cliente sin consentimiento.
- `tests/integration/trazabilidad.test.ts` — éxito deja 1 fila de auditoría con los campos;
  `trabajo` que inserta y luego lanza → 0 filas nuevas en la tabla mutada y en `audit_events`;
  logger capturando `process.stdout.write` con datos anidados → valores `[REDACTADO]` y JSON válido.
- `pnpm format`.

**Done when**
- [ ] WHEN `pnpm test tests/unit/authz.test.ts` se ejecuta THE SYSTEM SHALL comparar `can()` contra la tabla esperada de la prueba, que reproduce celda por celda la matriz rol × acción de §8, y terminar con código 0.
- [ ] WHEN un actor asesor llama `can()` con la acción `solicitud.ver` sobre un recurso cuyo `asesorId` es otro THE SYSTEM SHALL devolver `false`, y WHEN un cliente lo hace sobre un recurso cuyo `clienteId` no es el suyo THE SYSTEM SHALL devolver `false`.
- [ ] WHEN una mutación ejecutada con `conAuditoria()` lanza un error después de escribir THE SYSTEM SHALL revertir tanto la mutación como la fila de `audit_events`.
- [ ] WHEN una mutación ejecutada con `conAuditoria()` termina bien THE SYSTEM SHALL dejar exactamente una fila en `audit_events` con `accion`, `actor_id`, `target_type`, `target_id` y `metadata` del evento.
- [ ] WHEN el logger recibe un objeto con las claves `num_doc`, `email`, `celular` o `cta_numero` en cualquier nivel de anidación THE SYSTEM SHALL emitir una línea JSON donde esos valores son `[REDACTADO]`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/unit/authz.test.ts                      # expect: exit 0, 0 failed
pnpm test tests/integration/trazabilidad.test.ts        # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 4: autorizacion, auditoria transaccional y logger"
git tag step-04-autorizacion
```

---

#### Step 5 — Autenticación del staff (Entra, lista blanca, test-login)

**Do**
`BETTER_AUTH_SECRET` pasa a ser obligatoria **desde este paso**, exigida por `getAuth()` (no por
`env.ts`), así los gates de los pasos 1–4 siguen verdes; `.env.example` ya trae un valor de
desarrollo. Archivos:
- `src/server/auth/**`:
  `auth.ts` — `getAuth()` memoizado con la configuración de §8 (*Provider and rationale*);
  `databaseHooks.session.create.before: antesDeCrearSesion`; `sendVerificationOTP` envía la
  plantilla `otp` y, **solo si `NODE_ENV !== "production"`**, guarda el código en
  `otpParaPruebas` (Map en memoria). Microsoft solo con las 3 variables `ENTRA_*`.
  `actor.ts` — `getActor(headers): Promise<Actor | null>` con `auth.api.getSession({ headers })`;
  staff activo → actor staff (sesión > 12 h → `null`); si no, actor cliente (enlaza
  `clientes.user_id` por correo cuando está nulo; `consentimiento` = existe fila de la versión
  vigente; exporta `VERSION_CONSENTIMIENTO = "2026-11-v1"`, fuente única de la versión).
  `staff.ts` — `buscarStaffActivo(email)`, `antesDeCrearSesion(sesion)` (cuenta `microsoft` sin
  staff activo → `false`; enlaza `staff_members.user_id`), `crearStaff`, `cambiarRolStaff`,
  `desactivarStaff` (cada una con `can(actor, "staff.administrar")` y `conAuditoria`;
  desactivar borra las filas de `session` del usuario).
  `limite.ts` — `consumirLimite(clave, limite, ventanaSegundos)` con un único upsert atómico sobre
  `rate_limits` (si la ventana venció, reinicia `conteo` a 1) → `{ permitido, reintentarEn }`.
  `sesion-prueba.ts` — `iniciarSesionPorOtp(email): Promise<Response>` = `sendVerificationOTP` +
  `signInEmailOTP({ body: { email, otp }, asResponse: true })` usando `otpParaPruebas`; lanza si
  `NODE_ENV === "production"`. `cookieDe(respuesta)` devuelve el valor para la cabecera `cookie`.
- `src/server/correo/**` — `MailDriver { enviar(mensaje: { para, asunto, html, texto }) }`;
  `file` escribe `<MAIL_FILE_DIR>/<Date.now()>-<8 hex>-<para>.json` con `{ para, asunto, html, texto }`;
  `smtp` con nodemailer (`SMTP_HOST`, `SMTP_PORT`, sin TLS: solo Mailpit local); `acs` con
  `EmailClient` de `@azure/communication-email` (`beginSend` + `pollUntilDone`).
  `plantillas.ts` con las 7 plantillas de `docs/referencia/contratos.md` §10 (HTML con logo y
  colores de marca, versión texto que repite el código o el enlace).
- `src/app/api/auth/[...all]/route.ts` — `GET` delega en `getAuth().handler(request)`; `POST`
  intercepta `…/email-otp/send-verification-otp`: lee el correo de un `request.clone()`, correo de
  staff → 403 `USAR_MICROSOFT`; `consumirLimite("otp:<correo>", 5, 900)` y
  `("otp-ip:<ip>", 20, 900)` → 429 `LIMITE_EXCEDIDO` con `Retry-After`; luego delega.
- `src/app/api/test/login/route.ts` — `POST { email }`: si `NODE_ENV === "production"` o
  `AUTH_TEST_LOGIN !== "1"` → 404 `NO_ENCONTRADO`; correo sin staff activo → 404; si no,
  `return iniciarSesionPorOtp(email)`.
- `tests/integration/auth-staff.test.ts` — staff sembrado → `iniciarSesionPorOtp` → `getActor` con
  la cookie devuelve el rol; `antesDeCrearSesion` con usuario + cuenta `microsoft` sin staff →
  `false`; `desactivarStaff` → `getActor` con la cookie anterior → `null`; `POST` del test-login
  (llamando el handler) → 200 con `set-cookie` para staff y 404 para un correo cualquiera;
  `getAuth()` con secreto corto (`reiniciarEnvParaPruebas` + reset del memo) lanza nombrando
  `BETTER_AUTH_SECRET`; sin `ENTRA_*` la instancia arranca sin proveedor `microsoft`.
- `pnpm format`.

**Done when**
- [ ] WHEN `iniciarSesionPorOtp()` se usa con el correo de un `staff_members` activo THE SYSTEM SHALL crear una sesión y `getActor()` SHALL devolver un actor staff con el rol de esa fila.
- [ ] WHEN `antesDeCrearSesion()` evalúa la sesión de un usuario con cuenta del proveedor `microsoft` cuyo correo no es un `staff_members` activo THE SYSTEM SHALL devolver `false` y no se crea sesión.
- [ ] WHEN un administrador desactiva a un miembro del staff con `desactivarStaff()` THE SYSTEM SHALL borrar sus sesiones y `getActor()` con la cookie anterior SHALL devolver `null`.
- [ ] WHEN `POST /api/test/login` recibe el correo de un staff activo con `AUTH_TEST_LOGIN` en 1 y `NODE_ENV` distinto de `production` THE SYSTEM SHALL responder 200 con una cabecera `set-cookie` de sesión; WHEN el correo no es de un staff activo THE SYSTEM SHALL responder 404.
- [ ] WHEN `getAuth()` se inicializa sin `BETTER_AUTH_SECRET` o con menos de 32 caracteres THE SYSTEM SHALL lanzar un error que nombra `BETTER_AUTH_SECRET`.
- [ ] WHEN faltan `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` o `ENTRA_TENANT_ID` THE SYSTEM SHALL arrancar sin el proveedor `microsoft` registrado, sin fallar.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/auth-staff.test.ts          # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0 — también valida las claves del proveedor microsoft
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

El ingreso real con Entra (tenant, redirect URI, usuario de prueba) necesita la cuenta de Azure:
va en §20.1, no es un gate.

**Checkpoint**
```bash
git add -A && git commit -m "step 5: autenticacion del staff"
git tag step-05-auth-staff
```

---

#### Step 6 — Autenticación de clientes: registro, OTP, invitaciones y consentimiento

**Do**
Archivos:
- `src/server/clientes/acceso/**` — `registrarCliente(datos)` (§5 *Critical endpoints*: crea o
  reintenta; `DOCUMENTO_REGISTRADO`; correo en minúsculas); `crearInvitacion(actor, { tipoDoc,
  numDoc, nombre, email })` (asesor/coordinador, `can("cliente.invitar")`, crea o reutiliza el
  cliente, token de 32 bytes `randomBytes` en base64url, guarda su SHA-256, vence en 7 días, envía
  la plantilla `invitacion`, audita); `validarInvitacion(token)`; `aceptarInvitacion(actor, token)`
  (en transacción: vigente y sin usar, correo de la sesión = correo de la invitación; fija
  `accepted_at`, `clientes.asesor_id` y `user_id`; si no → `INVITACION_INVALIDA` 410);
  `registrarConsentimiento(actor, { ip, userAgent })` con `VERSION_CONSENTIMIENTO` importada de
  `@/server/auth/actor` y `TEXTO_CONSENTIMIENTO` (texto de `docs/referencia/contratos.md` §8);
  `estadoConsentimiento(actor)`.
- `src/app/api/v1/**` — `auth/registro/route.ts` (límite `registro:<ip>` 10/900 s),
  `auth/invitaciones/[token]/route.ts` (GET), `auth/invitaciones/[token]/aceptar/route.ts` (POST),
  `consentimiento/route.ts` (GET, POST). Todos con `leerCuerpo` + `respuestaError`; IP = primer
  valor de `x-forwarded-for`.
- `src/app/(publico)/**` — `layout.tsx` (contenedor centrado, logo `public/logo.png` con `alt`
  "Corban FC"), `page.tsx` (reemplaza la portada mínima del paso 1: «Abrir mi CDT», «Ya tengo
  cuenta», «Ingreso del equipo Corban»), `ingreso/page.tsx`, `registro/page.tsx`,
  `invitacion/[token]/page.tsx`, `consentimiento/page.tsx`, `ingreso-staff/page.tsx`. Formularios
  cliente con `createAuthClient` de `better-auth/react` + `emailOTPClient`; campo de código con
  `inputMode="numeric"` y `autoComplete="one-time-code"`; pegar permitido.
- `src/proxy.ts` — `export function proxy(request: NextRequest)`: sin cookie
  `better-auth.session_token` → `/mi-cuenta…` redirige a `/ingreso?siguiente=<ruta>`;
  `/asesor|/coordinador|/gerencia|/admin…` a `/ingreso-staff`. `export const config = { matcher:
  ["/mi-cuenta/:path*", "/asesor/:path*", "/coordinador/:path*", "/gerencia/:path*", "/admin/:path*"] }`
  (nunca `/api`). Sin `runtime` en el archivo (Next 16 lo rechaza en proxy).
- `tests/integration/auth-clientes.test.ts` — llama los handlers directamente con `Request`
  (cabecera `origin` = `getEnv().BETTER_AUTH_URL`); lee los OTP del último JSON de
  `.data/test-mail` para ese correo con `/\b(\d{6})\b/` sobre `texto`. Cubre: registro 201 y 409;
  6 envíos de OTP → el 6.º 429 sin archivo nuevo; código correcto → sesión y `clientes.user_id`
  enlazado (vía `getActor`); código incorrecto → 4xx sin sesión; invitación aceptada → `accepted_at`
  y `asesor_id`; segunda aceptación y una con `expires_at` en el pasado → 410; consentimiento POST
  → fila con versión, IP y user agent y GET `aceptado: true`; OTP para correo de staff → 403
  `USAR_MICROSOFT`. Cada prueba usa correos únicos (`crypto.randomUUID()`).
- `pnpm format`.

**Done when**
- [ ] WHEN `POST /api/v1/auth/registro` recibe un cuerpo válido THE SYSTEM SHALL crear una fila en `clientes` con `user_id` nulo y responder 201; WHEN el par (`tipo_doc`, `num_doc`) ya existe con otro correo THE SYSTEM SHALL responder 409 con código `DOCUMENTO_REGISTRADO`.
- [ ] WHEN `POST /api/auth/email-otp/send-verification-otp` se llama por sexta vez para el mismo correo dentro de 15 minutos THE SYSTEM SHALL responder 429 con código `LIMITE_EXCEDIDO` y no escribir archivo de correo.
- [ ] WHEN se envía a `POST /api/auth/sign-in/email-otp` el código de 6 dígitos leído del archivo de correo THE SYSTEM SHALL crear una sesión y enlazar `clientes.user_id` del cliente con ese correo; WHEN el código es incorrecto THE SYSTEM SHALL responder con estado 4xx y no crear sesión.
- [ ] WHEN un cliente con sesión acepta una invitación vigente THE SYSTEM SHALL fijar `invitaciones.accepted_at` y `clientes.asesor_id` al asesor que invitó; WHEN la misma invitación se acepta otra vez o tiene más de 7 días THE SYSTEM SHALL responder 410 con código `INVITACION_INVALIDA`.
- [ ] WHEN un cliente con sesión llama `POST /api/v1/consentimiento` THE SYSTEM SHALL guardar una fila en `consentimientos` con `version`, `accepted_at`, `ip` y `user_agent`, y `GET /api/v1/consentimiento` SHALL devolver `aceptado` en `true`.
- [ ] WHEN un correo de staff pide un OTP por HTTP THE SYSTEM SHALL responder 403 con código `USAR_MICROSOFT`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/auth-clientes.test.ts       # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 6: autenticacion de clientes"
git tag step-06-auth-clientes
```

---

#### Step 7 — Condiciones de tasa, festivos y motor de cálculo

**Do**
Archivos:
- `src/server/condiciones/**` — `en-letras.ts` (port literal de `enLetras`/`valorEnLetras` en
  `docs/referencia/contratos.md` §4, más `formatoMiles` y `tasaTexto`); `motor.ts`
  (`calcularCondiciones(entrada)` puro, algoritmo de §5 *Contratos internos*; fechas con
  `Date.UTC` y `getUTCDay`, nunca la zona local); `repositorio.ts` (listar/crear/editar/cerrar
  condiciones con validación de solape — misma entidad, plazo y periodicidad, rangos de monto que
  se cruzan y vigencias que se cruzan → `CONDICION_SOLAPADA` —; CRUD de `festivos`; edición de
  `monto_minimo`, `base_calculo`, `ajuste_no_habil` de `entidades`; cada escritura con
  `can("condiciones.administrar" | "festivos.administrar")` y `conAuditoria`);
  `opciones.ts` (`opcionesPara(actor, { entidadId, valor?, hoy })` → plazos con condición vigente
  hoy y, por plazo, periodicidades con su `tasaEa`); `calcular.ts` (`calcularParaSolicitud(db,
  entrada)` que carga entidad, filas y festivos y llama al motor).
- `src/app/(staff)/coordinador/**` — `condiciones/page.tsx` con pestañas Tasas · Entidades ·
  Festivos (tabla + formulario por pestaña), `condiciones/acciones.ts` (server actions con zod →
  repositorio). Filas con `creado_por` nulo muestran la insignia «DEMO». Elementos nativos +
  tokens (el paso 8 trae los componentes shadcn y el shell).
- `tests/helpers/fabricas.ts` — `crearStaff(rol)`, `crearClienteConSesion()` (registro +
  `iniciarSesionPorOtp` + consentimiento → `{ clienteId, cookie, actor }`), `sesionStaff(email)`,
  `crearCondicion(parcial)` con un `plazoDias` único por llamada (entre 400 y 3000) para no chocar
  con otras pruebas, `asegurarEntidades()` (= `sembrarBase` sin demo).
- `tests/unit/motor-calculo.test.ts` — exactamente los casos de abajo más selección (una fila →
  su id; ninguna → `SIN_CONDICION`; dos que se cruzan → `CONDICION_AMBIGUA`; valor bajo mínimo →
  `MONTO_MINIMO`; fila con `vigente_hasta` anterior a la apertura → excluida; `monto_max` inclusivo).
- `tests/integration/condiciones.test.ts` — solape rechazado sin filas; asesor → `PROHIBIDO`;
  coordinador escribe fila + auditoría; `opcionesPara` solo devuelve lo vigente.
- `pnpm format`.

Casos fijos del motor (§5; 2026-05-31 es domingo, 2026-02-28 sábado, 2026-03-01 domingo; el
festivo del caso 4 es dato de prueba):

| # | base | ajuste | festivos | apertura | plazo | fechaVenc |
|---|---|---|---|---|---|---|
| 1 | calendario | ninguno | — | 2026-03-02 | 90 | 2026-05-31 |
| 2 | calendario | siguiente_habil | — | 2026-03-02 | 90 | 2026-06-01 |
| 3 | calendario | anterior_habil | — | 2026-03-02 | 90 | 2026-05-29 |
| 4 | calendario | siguiente_habil | 2026-06-01 | 2026-03-02 | 90 | 2026-06-02 |
| 5 | comercial_360 | ninguno | — | 2026-01-31 | 30 | 2026-02-28 |
| 6 | comercial_360 | siguiente_habil | — | 2026-01-31 | 30 | 2026-03-02 |
| 7 | comercial_360 | ninguno | — | 2026-01-15 | 45 | 2026-03-02 |

`plazoMeses`: 90 → 3, 45 → 2, 100 → 3, 180 → 6. `valorEnLetras`: 50000000 → `CINCUENTA MILLONES DE
PESOS M/CTE`; 1234567 → `UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS
M/CTE`; 21000000 → `VEINTIÚN MILLONES DE PESOS M/CTE`; 101000 → `CIENTO UN MIL PESOS M/CTE`;
1000 → `MIL PESOS M/CTE`; 100 → `CIEN PESOS M/CTE`; 0 → cadena vacía. `formatoMiles(50000000)` →
`50.000.000`. `tasaTexto("10.5000")` → `10,50`.

**Done when**
- [ ] WHEN `pnpm test tests/unit/motor-calculo.test.ts` se ejecuta THE SYSTEM SHALL pasar los 7 casos de vencimiento (calendario y comercial 360, ajuste siguiente y anterior hábil con sábados, domingos y festivos), los de `plazoMeses` y los de `valorEnLetras` de la tabla de fixtures del paso 7, y terminar con código 0.
- [ ] WHEN ninguna fila de `condiciones_tasa` aplica a la entidad, valor, plazo, periodicidad y fecha de apertura THE SYSTEM SHALL devolver el error `SIN_CONDICION`; WHEN aplican dos o más THE SYSTEM SHALL devolver `CONDICION_AMBIGUA`.
- [ ] WHEN el valor es menor que `entidades.monto_minimo` THE SYSTEM SHALL devolver el error `MONTO_MINIMO`.
- [ ] WHEN el coordinador guarda una condición cuyo rango de monto y vigencia se cruzan con otra de la misma entidad, plazo y periodicidad THE SYSTEM SHALL rechazarla con `CONDICION_SOLAPADA` y no escribir filas.
- [ ] WHEN un asesor intenta crear o editar una condición o un festivo THE SYSTEM SHALL lanzar `PROHIBIDO` sin escribir filas; WHEN lo hace el coordinador THE SYSTEM SHALL escribir la fila y una fila de `audit_events`.
- [ ] WHEN se consulta `opcionesPara()` para una entidad y un valor THE SYSTEM SHALL devolver solo los plazos y periodicidades con condición vigente hoy, cada periodicidad con su `tasaEa`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/unit/motor-calculo.test.ts              # expect: exit 0, 0 failed
pnpm test tests/integration/condiciones.test.ts         # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 7: condiciones de tasa, festivos y motor de calculo"
git tag step-07-condiciones
```

---

#### Step 8 — Sistema de diseño y shells

**Do**
Archivos (más los que genera shadcn: `components.json`, `src/lib/utils.ts`, `src/components/ui/**`
y las dependencias que añade a `package.json`):
1. `pnpm dlx shadcn@4.23.0 init --base radix --no-monorepo` (si el CLI aún pregunta algo, repetir
   con la opción no interactiva que liste `pnpm dlx shadcn@4.23.0 init --help`, p. ej. `--defaults`).
2. `git checkout -- src/app/globals.css` — init reescribe los tokens; se restaura el archivo
   commiteado y se añade **una** línea, `@import "tw-animate-css";`, justo después de
   `@import "tailwindcss";` (init instala `tw-animate-css`).
3. `pnpm dlx shadcn@4.23.0 add button input label select textarea checkbox radio-group dialog sheet dropdown-menu table badge card tabs alert skeleton separator --yes --overwrite`;
   si `add` vuelve a tocar `globals.css`, repetir el paso 2.
4. `src/app/**/layout.tsx` — raíz: `next/font/local` con Inter (`./fonts/inter-latin.woff2`, peso
   `100 900`, `variable: "--font-inter"`) y Poppins (500/600/700, `variable: "--font-poppins"`),
   ambos con `display: "swap"`; `<html lang="es-CO" className={inter.variable + poppins.variable}>`;
   `<SaltarAlContenido />` como primer hijo de `<body>`. `(publico)/layout.tsx` → `ShellPublico`.
   `(cliente)/mi-cuenta/layout.tsx` → `getActor(await headers())`: sin sesión `/ingreso`, staff
   `/asesor`, sin `clienteId` muestra «Completa tu registro», sin consentimiento `/consentimiento`;
   envuelve en `ShellCliente`. `(staff)/layout.tsx` → solo staff activo (si no `/ingreso-staff`),
   `ShellStaff` con navegación filtrada por `can()`.
5. `src/components/**` — `shell/` (`ShellPublico`, `ShellCliente` con navegación inferior en
   móvil, `ShellStaff` con barra lateral navy ≥ 1024 px y `Sheet` < 1024 px, `SaltarAlContenido`
   con destino `#contenido` en el `<main>` de cada shell).
6. `tests/unit/contraste.test.ts` — lee `src/app/globals.css`, extrae `--color-<nombre>: #rrggbb`
   y comprueba ≥ 4,5 en los pares: foreground/background, foreground/card, muted-foreground/
   background, muted-foreground/card, primary/background, primary/card, primary-foreground/primary,
   primary-foreground/primary-dark, card/navy, destructive/background, destructive/card,
   destructive-foreground/destructive, success-strong/card, success-strong/background,
   card/success-strong, secondary-foreground/secondary.
7. `tests/e2e/responsive.spec.ts` — para 375, 768 y 1440 px de ancho: `/`, `/ingreso`,
   `/registro`, `/ingreso-staff` y `/coordinador/condiciones` (antes,
   `page.request.post("/api/test/login", { data: { email: "coordinador.e2e@corbanfc.com" } })`);
   en cada una `scrollWidth <= clientWidth`, `html[lang="es-CO"]`, un solo `h1` y el primer
   elemento enfocable es «Saltar al contenido». Además, sin sesión, `/mi-cuenta` termina en
   `/ingreso` y `/asesor` en `/ingreso-staff`.
8. `pnpm format`.

**Done when**
- [ ] WHEN `pnpm test tests/unit/contraste.test.ts` se ejecuta THE SYSTEM SHALL leer los colores de `src/app/globals.css` y comprobar que cada par texto/fondo de la lista de la prueba tiene contraste WCAG de al menos 4.5, terminando con código 0.
- [ ] WHEN `pnpm e2e tests/e2e/responsive.spec.ts` se ejecuta a 375, 768 y 1440 px de ancho THE SYSTEM SHALL comprobar `scrollWidth <= clientWidth` del elemento raíz en `/`, `/ingreso`, `/registro`, `/ingreso-staff` y `/coordinador/condiciones` con sesión de coordinador obtenida por `/api/test/login`.
- [ ] WHEN se renderiza cualquiera de esas páginas THE SYSTEM SHALL tener `lang` en `es-CO` en el elemento `html`, un único `h1` y el enlace «Saltar al contenido» como primer elemento enfocable.
- [ ] WHEN un visitante sin sesión pide `/mi-cuenta` o `/asesor` THE SYSTEM SHALL redirigirlo a `/ingreso` o a `/ingreso-staff` respectivamente.
- [ ] WHEN `pnpm build` se ejecuta THE SYSTEM SHALL terminar con código 0 con `src/app/layout.tsx` cargando Inter y Poppins mediante `next/font/local` con la opción `display` en `swap`.

**Verify**
```bash
pnpm exec playwright install chromium                   # expect: exit 0 (descarga el navegador la primera vez)
docker compose up -d --wait postgres                    # expect: exit 0
pnpm test tests/unit/contraste.test.ts                  # expect: exit 0, 0 failed
pnpm e2e tests/e2e/responsive.spec.ts                   # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
grep -q 'display: "swap"' src/app/layout.tsx            # expect: exit 0 — el criterio se verifica en la llamada al loader
```

En Linux sin las librerías del sistema que necesita Chromium, ejecutar una vez
`sudo pnpm exec playwright install-deps chromium` (prerrequisito de §10, no un gate).

**Checkpoint**
```bash
git add -A && git commit -m "step 8: sistema de diseno y shells"
git tag step-08-diseno
```

---

#### Step 9 — API v1 del cliente: perfil, solicitudes, borrador y envío

**Do**
Archivos:
- `src/lib/datos/**` — `catalogos.ts` (catálogos de `docs/referencia/contratos.md` §6 como
  `[valor, etiqueta][]` + `etiqueta(catalogo, valor)`); `esquemas.ts` (zod: un esquema parcial por
  paso — `cdt`, `personal`, `laboral`, `financiera`, `pago` — con dinero `/^\d{0,15}$/`, fechas
  `/^\d{4}-\d{2}-\d{2}$/`, enums de catálogo; `esquemaEnvio` con las obligatorias; `CLAVES_PERFIL`).
- `src/server/solicitudes/**` — `estados.ts` (tabla de transiciones de §5 como datos:
  `TRANSICIONES: { accion, desde[], hacia, roles }[]` y `puedeTransicionar(estado, accion, actor)`);
  `servicio.ts` (`crearBorrador(actor, { entidadId })` con `datos` precargados desde
  `clientes.perfil`, `asesor_id` = el del cliente; `actualizarPaso(actor, id, paso, datos)` solo en
  `borrador`/`devuelta` para el cliente, fusiona solo las claves del paso; `enviar(actor, id)`
  con validación, motor (`calcularParaSolicitud`), evento y auditoría en una transacción y copia a
  `clientes.perfil`; `listarMias(actor)`; `obtenerSolicitud(actor, id)` con `filtroVisibilidad`);
  `perfil.ts` (`obtenerPerfil`, `actualizarPerfil`); `visibilidad.ts` (`filtroVisibilidad(actor)`).
- `src/app/api/v1/**` — `perfil/route.ts` (GET, PATCH), `condiciones/opciones/route.ts` (GET),
  `solicitudes/route.ts` (GET, POST), `solicitudes/[id]/route.ts` (GET con eventos, PATCH
  `{ paso, datos }`), `solicitudes/[id]/enviar/route.ts` (POST). Cada handler: `getActor(request.headers)`
  → 401 si nulo; `exigirMismoOrigen` en mutaciones; servicio; `respuestaError`. `params` es una
  `Promise` en Next 16 (`const { id } = await context.params`).
- `tests/integration/api-v1.test.ts` — crear (201, código, precarga), PATCH de un paso, PATCH en
  estado no editable (409), enviar incompleto (422 con `fields`), enviar sin condición (422
  `SIN_CONDICION`), enviar completo con condición creada por `crearCondicion` (200,
  `pendiente_validacion`, 1 evento, 1 auditoría), cliente sin consentimiento (403).
- `tests/integration/aislamiento.test.ts` — cliente A pide la solicitud de B por GET, PATCH y
  enviar → 404 `NO_ENCONTRADO`; `obtenerSolicitud` con un asesor no asignado → `NO_ENCONTRADO`;
  el asesor asignado y el coordinador sí la ven.
- `pnpm format`.

**Done when**
- [ ] WHEN un cliente con consentimiento hace `POST /api/v1/solicitudes` con un `entidadId` válido THE SYSTEM SHALL responder 201 con `data.estado` en `borrador`, `data.codigo` que cumple `^SOL-\d{6}$` y `datos` precargados desde `clientes.perfil`.
- [ ] WHEN `PATCH /api/v1/solicitudes/{id}` recibe `paso` y `datos` de un borrador propio THE SYSTEM SHALL fusionar solo las claves de ese paso, validarlas con su esquema zod y responder 200; WHEN la solicitud no está en `borrador` ni `devuelta` THE SYSTEM SHALL responder 409 con código `TRANSICION_INVALIDA`.
- [ ] WHEN `POST /api/v1/solicitudes/{id}/enviar` se llama con campos obligatorios vacíos THE SYSTEM SHALL responder 422 con código `VALIDACION` y `fields` listando cada clave faltante, sin cambiar el estado.
- [ ] WHEN el envío es válido pero el motor no encuentra condición aplicable THE SYSTEM SHALL responder 422 con código `SIN_CONDICION`; WHEN es válido y hay condición THE SYSTEM SHALL pasar a `pendiente_validacion` y escribir un `solicitud_eventos` y un `audit_events`.
- [ ] WHEN el cliente A pide `GET /api/v1/solicitudes/{id}` de una solicitud del cliente B THE SYSTEM SHALL responder 404 con código `NO_ENCONTRADO`, y WHEN un asesor no asignado llama `obtenerSolicitud()` sobre ella THE SYSTEM SHALL lanzar `NO_ENCONTRADO`.
- [ ] WHEN un cliente sin consentimiento llama cualquier ruta `/api/v1/solicitudes` THE SYSTEM SHALL responder 403 con código `CONSENTIMIENTO_REQUERIDO`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/api-v1.test.ts              # expect: exit 0, 0 failed
pnpm test tests/integration/aislamiento.test.ts         # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 9: api v1 del cliente"
git tag step-09-api-v1
```

---

#### Step 10 — Asistente del cliente (mobile-first)

**Do**
Archivos:
- `src/app/(cliente)/mi-cuenta/**` — `page.tsx` (inicio: mis solicitudes con estado y siguiente
  paso; botón «Abrir un CDT»), `solicitudes/nueva/page.tsx` (tarjetas de entidad → `POST` →
  redirige a `editar?paso=cdt`), `solicitudes/[id]/editar/page.tsx`, `solicitudes/[id]/page.tsx`
  (línea de tiempo, observación de devolución y `<DocumentosSolicitud>` de
  `src/components/cliente/documentos-solicitud.tsx`, que en este paso solo muestra el mensaje
  vacío de §6 sin llamar a la API; el paso 13 lo amplía).
  `layout.tsx` (del paso 8) añade `ProveedorConsultas`.
- `src/components/cliente/**` — `proveedor-consultas.tsx`, `api.ts` (fetch a `/api/v1` que
  convierte el sobre de error en excepción tipada), hooks react-query, `asistente.tsx` y un
  componente por paso (§6 *Component hierarchy*); campos de la tabla de `docs/referencia/contratos.md`
  §6; dinero con `inputMode="numeric"` y miles con punto al mostrar; plazos como chips desde
  `/api/v1/condiciones/opciones` (Juriscoop muestra «N meses (aprox.)» si no es múltiplo de 30);
  vencimiento estimado y valor en letras en el resumen (los devuelve el servidor); autoguardado
  de §6; errores de §6 con `aria-describedby` y `role="alert"` en el resumen; foco al primer campo
  inválido; objetivos táctiles ≥ 44 px.
- `tests/e2e/apoyo.ts` — `iniciarSesionStaff(page, email)`, `leerOtp(email, dir = ".data/e2e-mail")`,
  `registrarClienteYConsentir(page)` (registro por UI, OTP del archivo, consentimiento) que
  devuelve el correo y el documento usados.
- `tests/e2e/asistente.spec.ts` — a 375 px: registro → `/mi-cuenta/solicitudes/nueva` → Ban100 →
  completa los pasos con datos del POC (valor 50000000, plazo 180) → recarga a mitad (valores
  restaurados) → «Siguiente» con obligatorio vacío (error visible y foco) → periodicidades
  mostradas con tasa → «Enviar a validación» → detalle muestra «Pendiente de validación».
- `tests/e2e/responsive.spec.ts` — añade `/mi-cuenta` y `/mi-cuenta/solicitudes/nueva` (cliente
  registrado con `apoyo.ts`); el inicio de sesión del coordinador pasa a usar `apoyo.ts`.
- `pnpm format`.

**Done when**
- [ ] WHEN un cliente de prueba completa los pasos CDT → personal → laboral → financiera → pago de intereses y cuenta → resumen y pulsa «Enviar a validación» THE SYSTEM SHALL mostrar el estado «Pendiente de validación» en `/mi-cuenta/solicitudes/{id}`.
- [ ] WHEN el cliente recarga la página a mitad del asistente THE SYSTEM SHALL restaurar todos los valores guardados por el autoguardado del paso anterior.
- [ ] WHEN un campo obligatorio está vacío y el cliente pulsa «Siguiente» THE SYSTEM SHALL permanecer en el paso, mostrar el error en texto junto al campo y mover el foco al primer campo inválido.
- [ ] WHEN se muestra el paso de pago de intereses THE SYSTEM SHALL listar solo las periodicidades que `GET /api/v1/condiciones/opciones` devuelve para la entidad, plazo y valor elegidos, cada una con su tasa E.A.
- [ ] WHEN `pnpm e2e tests/e2e/responsive.spec.ts` se ejecuta THE SYSTEM SHALL no reportar desbordamiento horizontal en `/mi-cuenta` ni en `/mi-cuenta/solicitudes/nueva` a 375, 768 y 1440 px.

**Verify**
```bash
pnpm exec playwright install chromium                   # expect: exit 0
docker compose up -d --wait postgres                    # expect: exit 0
pnpm e2e tests/e2e/asistente.spec.ts                    # expect: exit 0, 0 failed
pnpm e2e tests/e2e/responsive.spec.ts                   # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 10: asistente del cliente"
git tag step-10-asistente
```

---

#### Step 11 — Motor PDF y pruebas golden de los 6 formatos

**Do**
Archivos:
- `src/server/pdf/**` — `mapeo.ts` (lee y cachea `assets/formatos/mapping.json` y
  `mapping.cuenta-pago.json`, une las filas por `docKey`; tipo `FilaMapeo = { f: string; k: "t" | "d" | "c" | "x" | "s" | "tv" | "ch"; key?: string; val?: string; part?: string; fmt?: string; cond?: [string, string]; i?: number }`);
  `derivar.ts` (`derivarDatosPdf(datos, congelado)` de `docs/referencia/contratos.md` §5, usando
  `valorEnLetras`, `formatoMiles`, `tasaTexto` del paso 7 y `etiqueta` del paso 9);
  `motor.ts` (`generarPdf(docKey, D)` con el algoritmo de §5 *Contratos internos* en el orden
  exacto: cargar → deduplicar → limpiar → aplicar → `updateFieldAppearances(Helvetica)` → `save`);
  `nombres.ts` (prefijos de archivo y `nombreArchivo(docKey, apellido1, version)`).
- `tests/fixtures/cliente-ejemplo.json` — exactamente este contenido:
  ```json
  {
    "congelado": {
      "valor": 50000000,
      "plazoDias": 180,
      "periodicidad": "vencimiento",
      "tasaEa": "10.5000",
      "fechaApertura": "2026-03-02",
      "fechaVenc": "2026-08-31"
    },
    "datos": {
      "tipo_cdt": "desmaterializado",
      "ciudad": "Medellín",
      "oficina": "Poblado",
      "fecha_dilig": "2026-03-02",
      "forma_pago": "transferencia",
      "nombre1": "María",
      "nombre2": "Fernanda",
      "apellido1": "Gómez",
      "apellido2": "Restrepo",
      "tipo_doc": "CC",
      "num_doc": "43123456",
      "exp_fecha": "2005-03-14",
      "exp_lugar": "Medellín",
      "sexo": "F",
      "nac_fecha": "1985-07-22",
      "nac_pais": "Colombia",
      "nac_ciudad": "Medellín",
      "nacionalidad": "Colombiana",
      "estado_civil": "soltero",
      "personas_cargo": "1",
      "nivel_educ": "universitario",
      "profesion": "Contadora",
      "email": "maria.gomez@ejemplo.com",
      "celular": "3001234567",
      "tel_fijo": "6041234567",
      "direccion": "Calle 10 # 40-25 Apto 301",
      "barrio": "El Poblado",
      "ciudad_res": "Medellín",
      "depto_res": "Antioquia",
      "pais_res": "Colombia",
      "estrato": "5",
      "tipo_vivienda": "propia",
      "ocupacion": "empleado",
      "empresa": "Industrias Ejemplo S.A.S.",
      "nit_empresa": "900123456",
      "cargo": "Gerente financiera",
      "contrato": "indefinido",
      "fecha_ingreso": "2016-02-01",
      "dir_trab": "Carrera 43A # 1-50 Of. 502",
      "ciudad_trab": "Medellín",
      "depto_trab": "Antioquia",
      "pais_trab": "Colombia",
      "tel_trab": "6045551234",
      "ciiu": "6920",
      "actividad_desc": "Actividades de contabilidad",
      "ingresos": "12000000",
      "otros_ingresos": "1500000",
      "desc_otros": "Arrendamiento de un local",
      "egresos": "6500000",
      "activos": "480000000",
      "pasivos": "120000000",
      "declara_renta": "si",
      "cta_banco": "Bancolombia",
      "cta_tipo": "ahorros",
      "cta_numero": "12345678901",
      "cta_titular": "María Fernanda Gómez Restrepo"
    }
  }
  ```
- `tests/unit/pdf-mapeo.test.ts` — `ch` índice 2 de `12345678901` → `3`, índice 20 → vacío;
  `mismo("soltero", "Soltera")` y `mismo("si", "Sí")` → verdadero; `tv` solo con la condición;
  `d` con cada `part`; `formatoMiles` y `limpiar` (`"€"` → `"?"`).
- `tests/unit/pdf-golden.test.ts` — para cada uno de los 6 `docKey`: `generarPdf(docKey,
  derivarDatosPdf(fixture.datos, fixture.congelado))`; `reporte.notFound` vacío; reabrir los bytes
  con pdf-lib y construir `{ [campoMapeado]: texto | marcado | opción }` ordenado por clave;
  `expect(JSON.stringify(valores, null, 2) + "\n").toMatchFileSnapshot("./__snapshots__/pdf-<docKey>.json")`;
  todo campo no mapeado vacío (texto vacío o `undefined`, casilla sin marcar, radio sin
  selección); ningún campo de texto con dos widgets a menos de 3 pt.
- `tests/unit/__snapshots__/**` — los 6 `pdf-<docKey>.json` que **escribe la primera ejecución
  local** (Vitest no escribe snapshots nuevos con `CI` definido, por eso este paso corre en local y
  los commitea). Antes de commitearlos, abrir cada PDF generado una vez (escribirlos en
  `.data/golden/` durante la prueba) y compararlos con el POC; la revisión visual formal es un
  punto de §20.1.
- `pnpm format`.

**Done when**
- [ ] WHEN `pnpm test tests/unit/pdf-golden.test.ts` se ejecuta THE SYSTEM SHALL generar los 6 documentos `ban_vinc`, `ban_orden`, `colte_vinc`, `colte_cdt`, `juris` y `mmujer` con `tests/fixtures/cliente-ejemplo.json` y el reporte de cada uno SHALL tener `notFound` vacío.
- [ ] WHEN cada PDF generado se vuelve a abrir con pdf-lib THE SYSTEM SHALL producir un JSON de todos los campos mapeados con su valor o marca idéntico al snapshot commiteado en `tests/unit/__snapshots__/pdf-<docKey>.json`.
- [ ] WHEN se inspeccionan los campos que no aparecen en ningún mapeo de ese documento THE SYSTEM SHALL encontrarlos vacíos: texto vacío, casilla sin marcar y radio sin selección.
- [ ] WHEN se inspeccionan los widgets de cada campo de texto después de generar THE SYSTEM SHALL no encontrar dos widgets del mismo campo con rectángulos a menos de 3 pt entre sí.
- [ ] WHEN una fila de mapeo de tipo `ch` pide el índice 2 de `cta_numero` igual a `12345678901` THE SYSTEM SHALL escribir `3`, y WHEN el índice está fuera de rango THE SYSTEM SHALL dejar el campo vacío.
- [ ] WHEN una fila de tipo `c` compara `soltero` con `Soltera` o `si` con `Sí` THE SYSTEM SHALL marcar la casilla, porque la comparación ignora mayúsculas y tildes y trata la `o` final como `a`.

**Verify**
```bash
pnpm test tests/unit/pdf-mapeo.test.ts                  # expect: exit 0, 0 failed
pnpm test tests/unit/pdf-golden.test.ts                 # expect: exit 0 — la primera vez escribe los 6 snapshots
pnpm test tests/unit/pdf-golden.test.ts                 # expect: exit 0 — la segunda compara: la generación es determinista
test -f tests/unit/__snapshots__/pdf-ban_vinc.json      # expect: exit 0
test -f tests/unit/__snapshots__/pdf-ban_orden.json     # expect: exit 0
test -f tests/unit/__snapshots__/pdf-colte_vinc.json    # expect: exit 0
test -f tests/unit/__snapshots__/pdf-colte_cdt.json     # expect: exit 0
test -f tests/unit/__snapshots__/pdf-juris.json         # expect: exit 0
test -f tests/unit/__snapshots__/pdf-mmujer.json        # expect: exit 0
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 11: motor pdf y golden de los 6 formatos"
git tag step-11-motor-pdf
git ls-files --error-unmatch tests/unit/__snapshots__/pdf-mmujer.json   # expect: exit 0 — commiteado arriba
```

---

#### Step 12 — Máquina de estados, validación del asesor y PDFs versionados

**Do**
Archivos:
- `src/server/almacenamiento/**` — `StorageDriver { put(ruta, bytes, tipo): Promise<void>; get(ruta): Promise<Uint8Array>; delete(ruta): Promise<void>; signedUrl(ruta, segundos): Promise<string | null> }`;
  `fs` bajo `STORAGE_FS_ROOT` (crea directorios, rechaza rutas con `..`, `signedUrl` → `null`:
  el handler entrega los bytes); `azure` con `@azure/storage-blob`: con
  `AZURE_STORAGE_CONNECTION_STRING` → `BlobServiceClient.fromConnectionString` y
  `generateSasUrl` de lectura por 300 s; sin ella → `DefaultAzureCredential` de `@azure/identity`
  + `getUserDelegationKey` + `generateBlobSASQueryParameters`. Contenedor privado, nunca público.
  `getStorage()` elige por `STORAGE_DRIVER`.
- `src/server/solicitudes/**` — `transiciones.ts` (`ejecutarTransicion(actor, id, accion, entrada)`:
  transacción con `select … for update`, `can()`, `puedeTransicionar()`, efecto de la acción,
  `solicitud_eventos` + `audit_events`; acciones `aprobar`, `devolver`, `cancelar`,
  `enviar_entidad` y `enviar` migrado aquí); `aprobacion.ts` (congelar + versión 1 + PDFs:
  `derivarDatosPdf` → `generarPdf` por `doc_key` → `put` en `solicitudes/<id>/v1/<archivo>` →
  `documentos`; `notFound` no vacío → error interno y rollback; si la transacción falla, borra lo
  subido); `documentos.ts` (listar y obtener para cliente y staff con visibilidad);
  `notificaciones.ts` (stub: `notificarTransicion(evento)` solo registra con el logger; el paso 18
  lo completa). Se invoca **después** del commit.
- `src/app/api/staff/solicitudes/**` — `[id]/[accion]/route.ts` (POST `aprobar`, `devolver`
  `{ observacion }`, `cancelar` `{ motivo }`, `enviar-entidad` `{ fechaEnvio, radicado? }`),
  `[id]/documentos/[docId]/route.ts` (GET).
- `src/app/api/v1/solicitudes/**` — `[id]/documentos/route.ts` (GET) y
  `[id]/documentos/[docId]/route.ts` (GET: `fs` → bytes con `content-type: application/pdf` y
  `content-disposition: attachment; filename="<nombre>"`; `azure` → 302 a la URL SAS).
- `tests/integration/estados.test.ts` — recorre cada fila de la tabla de §5 con un actor válido y
  todas las demás combinaciones (estado × acción) → `TRANSICION_INVALIDA` sin filas nuevas;
  aprobación completa (7 campos congelados, versión 1, un `documentos` por `doc_key` con sha256
  igual al de `get()`); devolver sin observación → 422; descarga del dueño 200 con sha256 igual y
  de otro cliente 404; una fila de evento y una de auditoría por transición; driver `fs` escribe
  bajo `STORAGE_FS_ROOT` y `get()` devuelve los mismos bytes.
- `pnpm format`.

**Done when**
- [ ] WHEN `pnpm test tests/integration/estados.test.ts` se ejecuta THE SYSTEM SHALL comprobar cada fila de la tabla de transiciones (estado origen, acción, rol) y que toda combinación fuera de la tabla responde `TRANSICION_INVALIDA` (409) sin escribir filas.
- [ ] WHEN el asesor asignado aprueba una solicitud en `pendiente_validacion` THE SYSTEM SHALL, en una transacción, copiar `valor`, `plazo_dias`, `periodicidad`, `tasa_ea`, `fecha_apertura`, `fecha_venc` y `condicion_id` a la solicitud, crear `solicitud_versiones` número 1, guardar un PDF por cada `doc_key` de la entidad con `version` 1 y `sha256`, y pasar a `pendiente_firma`.
- [ ] WHEN el asesor devuelve sin observación THE SYSTEM SHALL responder 422 con código `MOTIVO_REQUERIDO` y conservar el estado.
- [ ] WHEN el cliente dueño pide `GET /api/v1/solicitudes/{id}/documentos/{docId}` THE SYSTEM SHALL responder 200 `application/pdf` cuyos bytes tienen el `sha256` guardado; WHEN lo pide otro cliente THE SYSTEM SHALL responder 404.
- [ ] WHEN cualquier transición se completa THE SYSTEM SHALL escribir exactamente una fila en `solicitud_eventos` y una en `audit_events` con `accion` igual a `solicitud.` seguido del nombre de la acción.
- [ ] WHEN el driver de almacenamiento `fs` guarda un archivo THE SYSTEM SHALL escribirlo bajo `STORAGE_FS_ROOT` y `get()` SHALL devolver los mismos bytes, sin escribir nada bajo `public/`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/estados.test.ts             # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

El driver `azure` con una cuenta real (SAS, identidad administrada) va en §20.1.

**Checkpoint**
```bash
git add -A && git commit -m "step 12: maquina de estados, validacion y pdfs versionados"
git tag step-12-validacion
```

---

#### Step 13 — Carga del documento firmado y revisión

**Do**
Archivos:
- `src/server/firmas/**` — `tipoPorBytes(bytes)` (`%PDF-`, `FF D8 FF`, firma PNG de 8 bytes; otro
  → `null`); `unirEnPdf(archivos)` (§5 *Critical endpoints*: A4 595.28 × 841.89 pt, margen 24 pt,
  escalar para caber y centrar; PDF → `copyPages`); `cargarFirmado(actor, id, archivos)`
  (límites, `consumirLimite("firmados:<userId>", 20, 3600)`, un solo PDF, `documentos`
  `firmado` versión actual, transición `cargar_firma` con `ejecutarTransicion`);
  `revisarFirma(actor, id, "aceptar" | "rechazar", motivo?)`.
- `src/app/api/v1/solicitudes/**` — `[id]/firmados/route.ts` (POST multipart `archivos`; el
  tamaño se suma de `File.size` **antes** de leer bytes).
- `src/app/api/staff/solicitudes/**` — `[id]/firma/[accion]/route.ts` (`aceptar`, `rechazar`
  `{ motivo }`).
- `src/components/cliente/**` — `carga-firmada.tsx` en el detalle del cliente: `<input
  type="file" multiple accept="image/*,application/pdf" capture="environment">`, lista de
  archivos con tamaño, total, botón «Subir firma»; mensajes de 413/415 en texto.
  `documentos-solicitud.tsx` pasa a listar (react-query) los documentos de la versión actual y el aviso de secciones en blanco por diseño (PEP,
  FATCA/CRS, moneda extranjera, origen de fondos, referencias, cónyuge, firmas y huellas).
- `tests/integration/firmas.test.ts` — genera PNG válidos en la prueba con un codificador mínimo
  (`node:zlib` `deflateSync` + `zlib.crc32` para los chunks IHDR/IDAT/IEND), sin binarios en el
  repo; 2 PNG → PDF de 2 páginas A4 y `firma_en_revision`; un archivo de texto con MIME
  `image/png` → 415 sin documento; 11 archivos o > 15 MB (archivo de relleno en memoria) → 413;
  aceptar → `aceptado` + `lista_para_enviar`; rechazar con motivo → `rechazado` + `pendiente_firma`;
  rechazar sin motivo → 422.
- `pnpm format`.

**Done when**
- [ ] WHEN el cliente dueño sube 2 imágenes PNG a `POST /api/v1/solicitudes/{id}/firmados` en `pendiente_firma` THE SYSTEM SHALL guardar un único PDF de 2 páginas A4 como documento tipo `firmado` y pasar la solicitud a `firma_en_revision`.
- [ ] WHEN un archivo no empieza por `%PDF-`, `FF D8 FF` ni la firma PNG, aunque declare un MIME permitido, THE SYSTEM SHALL responder 415 con código `TIPO_NO_PERMITIDO` y no guardar nada.
- [ ] WHEN llegan más de 10 archivos o más de 15 MB en total THE SYSTEM SHALL responder 413 con código `CARGA_DEMASIADO_GRANDE`.
- [ ] WHEN el asesor acepta el firmado THE SYSTEM SHALL marcarlo `aceptado` y pasar a `lista_para_enviar`; WHEN lo rechaza con motivo THE SYSTEM SHALL marcarlo `rechazado` con `motivo_rechazo` y volver a `pendiente_firma`.
- [ ] WHEN el asesor rechaza sin motivo THE SYSTEM SHALL responder 422 con código `MOTIVO_REQUERIDO`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/firmas.test.ts              # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 13: carga firmada y revision"
git tag step-13-firmas
```

---

#### Step 14 — Espacio de trabajo del asesor

**Do**
Archivos:
- `src/server/solicitudes/**` — `consultas.ts` (`bandeja(actor, pagina)`: primero
  `pendiente_validacion` y `firma_en_revision` y luego el resto, por `updated_at`; `listado(actor,
  { q, estado, entidad, asesor, pagina, porPagina })` con `ILIKE` sobre `codigo`, `clientes.nombre`
  y `clientes.num_doc`, siempre `LIMIT/OFFSET` + `count(*)`; `detalleStaff(actor, id)` con
  eventos, versiones, documentos por versión y `alertaVigencia`); `edicion.ts`
  (`editarComoStaff(actor, id, cambios, motivo)`: sin motivo → `MOTIVO_REQUERIDO`; en
  `borrador`/`devuelta`/`pendiente_validacion` edita sin cambiar estado; en los estados de
  `editar_post_aprobacion` recalcula con el motor (tabla vigente hoy), `version_actual + 1`, nueva
  `solicitud_versiones`, PDFs nuevos, generados y firmados anteriores → `desactualizado`, estado
  `pendiente_firma`; diffs `{campo, antes, despues}` en `metadata.cambios`); `notas.ts`
  (`agregarNota`); `reasignacion.ts` (`reasignarCliente(actor, clienteId, asesorId)`,
  `can("cliente.reasignar")`, actualiza `clientes.asesor_id` y el `asesor_id` de sus solicitudes
  que no están en `cdt_constituido` ni `cancelada`).
- `src/app/(staff)/asesor/**` — `page.tsx` (bandeja), `solicitudes/page.tsx` (lista con filtros
  en `searchParams`; filtro de asesor solo para coordinador), `solicitudes/[id]/page.tsx`
  (§6 *Component hierarchy*; acciones según la tabla de estados: aprobar, devolver, cancelar,
  revisar firma, enviar a la entidad), `solicitudes/[id]/acciones.ts` (server actions: edición,
  nota, reasignación, enviar a la entidad), `clientes/page.tsx` y `clientes/acciones.ts`
  (mis clientes; invitar con `crearInvitacion` del paso 6). `loading.tsx` y `error.tsx` en cada
  segmento.
- `src/components/staff/**` — `tabla-paginada.tsx` (filas de 40 px; bajo 768 px tarjetas apiladas),
  `linea-de-tiempo.tsx`, `insignia-estado.tsx` (texto + color), `dialogo-motivo.tsx` (motivo
  obligatorio).
- `tests/integration/asesor.test.ts` — siembra 60 solicitudes de un asesor; bandeja ordenada;
  páginas de 25, 25 y 10; búsqueda por código, nombre y documento; edición en
  `firma_en_revision` → versión 2, PDFs v2, firmado `desactualizado`, `pendiente_firma`, diffs;
  sin motivo → `MOTIVO_REQUERIDO`; reasignación por coordinador y 404 para el asesor anterior;
  asesor reasignando → `PROHIBIDO`; condición congelada con `vigente_hasta` en el pasado →
  `alertaVigencia` verdadero.
- `pnpm format`.

**Done when**
- [ ] WHEN un asesor abre la bandeja THE SYSTEM SHALL listar primero las solicitudes de sus clientes en `pendiente_validacion` y `firma_en_revision`, paginadas en el servidor de a 25.
- [ ] WHEN el listado recibe `q` con un código, un nombre o un número de documento THE SYSTEM SHALL devolver solo las filas que coinciden, y con 60 solicitudes sembradas en la prueba SHALL devolver páginas de 25, 25 y 10 filas.
- [ ] WHEN un asesor edita con motivo una solicitud en `firma_en_revision` THE SYSTEM SHALL crear `solicitud_versiones` número N+1, regenerar los PDF con versión N+1, marcar `desactualizado` el firmado anterior, pasar a `pendiente_firma` y guardar en `audit_events.metadata` los cambios con `campo`, `antes` y `despues`.
- [ ] WHEN la edición llega sin motivo THE SYSTEM SHALL lanzar `MOTIVO_REQUERIDO` y no cambiar nada.
- [ ] WHEN el coordinador reasigna un cliente a otro asesor THE SYSTEM SHALL actualizar `clientes.asesor_id` y el `asesor_id` de sus solicitudes no finales, y el asesor anterior SHALL recibir `NO_ENCONTRADO` al pedirlas; WHEN un asesor intenta reasignar THE SYSTEM SHALL lanzar `PROHIBIDO`.
- [ ] WHEN la condición congelada de una solicitud en `pendiente_firma`, `firma_en_revision` o `lista_para_enviar` tiene `vigente_hasta` anterior a hoy THE SYSTEM SHALL devolver `alertaVigencia` en `true` en el detalle del asesor.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/asesor.test.ts              # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 14: espacio de trabajo del asesor"
git tag step-14-asesor
```

---

#### Step 15 — Envío a la entidad, constitución y portafolio

**Do**
Archivos:
- `src/server/portafolio/**` — `constituir.ts` (`constituir(actor, id, { numeroCdt, valor,
  tasaEa, fechaApertura, fechaVenc })` vía `ejecutarTransicion` con la acción `constituir`:
  inserta `cdts` (`origen` `solicitud`, `periodicidad` congelada, `solicitud_id`), fija
  `constituida_at`; violación de `cdts_entidad_numero_uq` → `CONFLICTO` y rollback);
  `consultas.ts` (`portafolioDe(actor, clienteId?)`: vigentes = `estado = 'vigente'` y
  `fecha_venc >= hoy` (America/Bogota), `totalInvertido`, `proximosVencimientos` ascendentes;
  visibilidad por `portafolio.ver`).
- `src/app/(staff)/asesor/**` — formulario «Registrar constitución» en el detalle cuando el estado
  es `enviada_entidad` (prellenado con los valores congelados, editable) + server action.
- `src/app/(cliente)/mi-cuenta/**` — `portafolio/page.tsx` (tarjetas de CDT vigentes, total,
  próximos vencimientos, estado vacío de §6) y el resumen en el inicio.
- `src/app/api/v1/**` — `portafolio/route.ts` (GET).
- `tests/integration/portafolio.test.ts` — constitución completa (estado, `constituida_at`, 1 fila
  en `cdts`); número repetido → 409 con una sola fila y estado sin cambio; portafolio del dueño
  (suma, orden, exclusión de vencidos) y de otro cliente sin esos CDT; cancelar constituida → 409.
- `pnpm format`.

**Done when**
- [ ] WHEN el asesor constituye una solicitud en `enviada_entidad` con `numero_cdt`, `valor`, `tasa_ea`, `fecha_apertura` y `fecha_venc` finales THE SYSTEM SHALL pasarla a `cdt_constituido`, fijar `constituida_at` y crear exactamente una fila en `cdts` con `origen` en `solicitud`.
- [ ] WHEN se intenta constituir con un `numero_cdt` que ya existe para esa entidad THE SYSTEM SHALL responder `CONFLICTO` (409), dejar una sola fila en `cdts` y la solicitud en `enviada_entidad`.
- [ ] WHEN el cliente dueño llama `GET /api/v1/portafolio` THE SYSTEM SHALL devolver sus CDT vigentes, `totalInvertido` igual a la suma de su `valor` y `proximosVencimientos` en orden ascendente de `fecha_venc`, sin CDT de otros clientes.
- [ ] WHEN un CDT tiene `fecha_venc` anterior a hoy THE SYSTEM SHALL excluirlo de los vigentes del portafolio aunque su `estado` sea `vigente`.
- [ ] WHEN se intenta cancelar una solicitud en `cdt_constituido` THE SYSTEM SHALL responder `TRANSICION_INVALIDA` (409).

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/portafolio.test.ts          # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 15: envio, constitucion y portafolio"
git tag step-15-portafolio
```

---

#### Step 16 — Importación desde Excel

**Do**
Archivos:
- `src/server/importacion/**` — `catalogo.ts` (destinos: `cliente.tipo_doc`, `cliente.num_doc`,
  `cliente.nombres` (se divide en nombre1/apellido1 si no vienen separados), `cliente.email`,
  `cliente.celular`, `cliente.<cualquier clave de perfil>` de `docs/referencia/contratos.md` §6,
  `cdt.entidad`, `cdt.numero_cdt`, `cdt.valor`, `cdt.tasa_ea`, `cdt.fecha_apertura`,
  `cdt.fecha_venc`, `cdt.periodicidad`, `cdt.estado`, `ignorar`); `leer.ts` (exceljs: primera
  hoja, fila 1 = encabezados); `normalizar.ts` (fechas `dd/mm/yyyy`, `yyyy-mm-dd`, `Date` de
  exceljs o serial de Excel (días desde 1899-12-30) → ISO; entidad por id o nombre sin tildes;
  valor a entero; errores por fila: fecha inválida, entidad desconocida, documento vacío);
  `perfiles.ts` (CRUD de `import_perfiles`); `importar.ts` (`vistaPrevia(actor, archivo,
  perfilId)` → máx. 50 filas con errores; `confirmar(actor, archivo, perfilId)` → bloques de 200
  filas, una transacción por bloque, upsert de `clientes` por (`tipo_doc`, `num_doc`) fusionando
  `perfil` y de `cdts` por (`entidad_id`, `numero_cdt`) con `origen` `importacion`; una fila
  cuenta como **actualizada** solo si algún valor cambió y como **sin cambios** si no; rechazos a
  un .xlsx (columnas originales + `motivo`) guardado con `StorageDriver`; fila en `import_cargas`;
  auditoría por bloque). `can("importacion.ejecutar")` en todo.
- `src/app/(staff)/coordinador/importar/**` — subir .xlsx → mapear columnas (select por
  encabezado, guardar perfil con nombre) → vista previa con errores por fila → confirmar →
  resumen con enlace de rechazos.
- `src/app/api/staff/importaciones/**` — `vista-previa/route.ts`, `confirmar/route.ts`
  (multipart `archivo` + `perfilId`), `[cargaId]/rechazos/route.ts` (GET .xlsx).
- `tests/integration/importacion.test.ts` — construye el .xlsx en la prueba con exceljs (filas
  válidas, una fecha `31/02/2026`, una entidad `Banco X`, un documento vacío, una fecha como serial
  de Excel); vista previa ≤ 50 filas con los 3 tipos de error; confirmar → contadores y
  `import_cargas`; segunda importación del mismo archivo → 0 creadas, 0 actualizadas y valores
  idénticos (comparar filas antes/después); rechazos descargables releídos con exceljs con la
  columna `motivo`; cliente importado → `crearBorrador` precarga `datos` desde su perfil; asesor
  → 403.
- `pnpm format`.

**Done when**
- [ ] WHEN se previsualiza un .xlsx con un perfil de mapeo guardado THE SYSTEM SHALL devolver como máximo 50 filas, cada una con sus errores: fecha inválida (se aceptan dd/mm/yyyy, yyyy-mm-dd y serial de Excel), entidad desconocida y documento vacío.
- [ ] WHEN se confirma la importación THE SYSTEM SHALL hacer upsert de `clientes` por (`tipo_doc`, `num_doc`) y de `cdts` por (`entidad_id`, `numero_cdt`) en una transacción por bloque de 200 filas y escribir una fila en `import_cargas` con creadas, actualizadas, sin cambios y rechazadas.
- [ ] WHEN el mismo archivo se importa por segunda vez THE SYSTEM SHALL reportar 0 creadas y 0 actualizadas y no cambiar ningún valor en `clientes` ni en `cdts`.
- [ ] WHEN hay filas rechazadas THE SYSTEM SHALL guardar un .xlsx de rechazos con las columnas originales más la columna `motivo` y permitir descargarlo.
- [ ] WHEN un cliente importado inicia una nueva solicitud THE SYSTEM SHALL precargar `datos` con las claves de `clientes.perfil` que trajo la importación.
- [ ] WHEN un asesor llama las rutas de importación THE SYSTEM SHALL responder 403 con código `PROHIBIDO`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/importacion.test.ts         # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 16: importacion desde excel"
git tag step-16-importacion
```

---

#### Step 17 — Reportes de gerencia y exportación

**Do**
Archivos:
- `src/server/reportes/**` — `inversion(actor, filtros)` (suma de `valor` de CDT vigentes por
  entidad y por asesor del cliente), `vencimientos(actor, dias)` (30, 60 o 90: vigentes con
  `fecha_venc` entre hoy y hoy + días, ascendente), `resumenSolicitudes(actor, filtros)` (conteo
  por estado; promedio de días entre `created_at` y `constituida_at`); filtros `desde`, `hasta`,
  `entidadId`, `asesorId`; `can("reportes.ver")`; `exportarXlsx(reporte, filas)` con exceljs
  (encabezados en español: Entidad, Asesor, Total invertido (COP); Cliente, Entidad, Número CDT,
  Valor (COP), Vencimiento; Estado, Cantidad, Promedio de días).
- `src/app/(staff)/gerencia/**` — `page.tsx` (filtros en `searchParams`, tarjetas y tablas,
  botón «Exportar a Excel» por reporte), `loading.tsx`, `error.tsx`.
- `src/app/api/staff/reportes/**` — `[reporte]/xlsx/route.ts` (`inversion`, `vencimientos`,
  `solicitudes`; `content-type`
  `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- `src/components/staff/**` — `graficos/barras-inversion.tsx` y `graficos/barras-estados.tsx`
  (`"use client"`, recharts; colores de tokens; tabla equivalente debajo para lectores de pantalla).
- `tests/integration/reportes.test.ts` — siembra CDT en 2 entidades y 2 asesores (incluido uno
  vencido) y solicitudes en varios estados; compara cada reporte con una consulta SQL directa;
  exportación releída con exceljs; cliente y asesor → 403.
- `pnpm format`.

**Done when**
- [ ] WHEN se calcula el reporte de inversión THE SYSTEM SHALL devolver el total por entidad y por asesor igual a la suma SQL de `valor` de los `cdts` vigentes sembrados en la prueba.
- [ ] WHEN se calcula el reporte de vencimientos a 30, 60 y 90 días THE SYSTEM SHALL listar solo CDT vigentes con `fecha_venc` dentro de cada ventana, en orden ascendente.
- [ ] WHEN se calcula el resumen de solicitudes THE SYSTEM SHALL devolver el conteo por estado y el promedio de días entre `created_at` y `constituida_at` de las constituidas, respetando los filtros de fechas, entidad y asesor.
- [ ] WHEN se pide `GET /api/staff/reportes/{reporte}/xlsx` THE SYSTEM SHALL responder un .xlsx cuya primera hoja, releída con exceljs, tiene la fila de encabezados y las filas de datos del reporte.
- [ ] WHEN un cliente o un asesor pide un reporte THE SYSTEM SHALL responder 403 con código `PROHIBIDO`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/reportes.test.ts            # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 17: reportes de gerencia"
git tag step-17-reportes
```

---

#### Step 18 — Notificaciones, PWA y administración del staff

**Do**
Archivos:
- `src/server/solicitudes/notificaciones.ts` — reemplaza el stub: `notificarTransicion(evento)`
  elige destinatario y plantilla según `docs/referencia/contratos.md` §10 (`pendiente_validacion`
  → asesor asignado o, si no hay, todos los coordinadores activos; `devuelta`, `pendiente_firma` y
  `cdt_constituido` → cliente; `firma_en_revision` → asesor), envía por `MailDriver` y fija
  `solicitud_eventos.notificado_at`; si el envío falla registra `log.error` con el id del evento
  (sin correo ni documento) y deja `notificado_at` nulo; nunca lanza.
- `src/app/(staff)/admin/**` — `staff/page.tsx` (tabla del staff; crear con correo, nombre y rol;
  cambiar rol; desactivar con confirmación que nombra a la persona) y `staff/acciones.ts`
  (server actions → `crearStaff`/`cambiarRolStaff`/`desactivarStaff` del paso 5).
- `src/app/manifest.ts` — `MetadataRoute.Manifest`: `name` "Corban CDT", `short_name`
  "Corban CDT", `start_url` "/mi-cuenta", `display` "standalone", `background_color` "#F5F6F7",
  `theme_color` "#1D2226", `lang` "es-CO", `icons` `/iconos/192` y `/iconos/512` (`image/png`,
  `purpose` "any").
- `src/app/iconos/[tamano]/route.tsx` — `GET` con `ImageResponse` de `next/og`: cuadrado navy
  `#1D2226` del tamaño pedido (solo `192` o `512`, otro → 404) con `public/logo.png` centrado al
  60 % del ancho (leído con `fs` y pasado como `data:image/png;base64`). Cuando llegue el SVG, se
  cambia solo la imagen fuente.
- `tests/integration/notificaciones.test.ts` — envío → archivo en `.data/test-mail` para el
  destinatario correcto con el código de la solicitud y `notificado_at` fijado; driver que falla
  (stub de `MailDriver`) → transición intacta, `notificado_at` nulo, log sin PII; admin crea /
  cambia rol / desactiva con auditoría y coordinador → `PROHIBIDO`; `manifest()` importado de
  `@/app/manifest` devuelve `name`, `start_url`, `display` y los dos íconos exactos (el smoke
  del Verify confirma que el servidor lo sirve con 200).
- `pnpm format`.

**Done when**
- [ ] WHEN una solicitud pasa a `pendiente_validacion` THE SYSTEM SHALL enviar un correo al asesor asignado, o a los coordinadores si no tiene, y WHEN pasa a `pendiente_firma` o `devuelta` THE SYSTEM SHALL enviar un correo al cliente, cada uno con el código de la solicitud y un enlace a su detalle.
- [ ] WHEN el envío de un correo falla THE SYSTEM SHALL conservar la transición, registrar el error en el log sin datos personales y dejar `solicitud_eventos.notificado_at` en nulo.
- [ ] WHEN `manifest()` se evalúa THE SYSTEM SHALL devolver `name` Corban CDT, `start_url` /mi-cuenta, `display` standalone e íconos de 192 y 512 px, y WHEN el servidor standalone recibe `GET /manifest.webmanifest` THE SYSTEM SHALL responder 200 con ese `start_url` en el cuerpo.
- [ ] WHEN el servidor standalone recibe `GET /iconos/192` o `GET /iconos/512` THE SYSTEM SHALL responder 200 con una imagen PNG.
- [ ] WHEN un admin crea, cambia de rol o desactiva un miembro del staff desde `/admin/staff` THE SYSTEM SHALL escribir la fila y un `audit_events`; WHEN lo intenta un coordinador THE SYSTEM SHALL lanzar `PROHIBIDO`.

**Verify**
```bash
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test tests/integration/notificaciones.test.ts      # expect: exit 0, 0 failed
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
pnpm build                                              # expect: exit 0
sh scripts/smoke-standalone.sh /manifest.webmanifest /mi-cuenta   # expect: exit 0 — 200 y el start_url en el cuerpo
sh scripts/smoke-standalone.sh /iconos/192 PNG          # expect: exit 0 — la firma PNG está en los primeros bytes
sh scripts/smoke-standalone.sh /iconos/512 PNG          # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 18: notificaciones, pwa y administracion del staff"
git tag step-18-notificaciones
```

---

#### Step 19 — Endurecimiento y E2E de los 4 flujos

**Do**
Archivos:
- `next.config.ts` — añade `async headers()` con, para `source: "/(.*)"`:
  `Content-Security-Policy` = `default-src 'self'; script-src 'self' 'unsafe-inline'` + (solo si
  `NODE_ENV === "development"`) ` 'unsafe-eval'` + `; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`;
  `Strict-Transport-Security` = `max-age=63072000; includeSubDomains`;
  `X-Content-Type-Options` = `nosniff`; `Referrer-Policy` = `strict-origin-when-cross-origin`;
  `X-Frame-Options` = `DENY`; `Permissions-Policy` = `camera=(self), microphone=(), geolocation=()`.
- `tests/e2e/apoyo.ts` — añade `crearSolicitudCompleta(page)`, `aprobarComoAsesor(page, codigo)`,
  `pngDePrueba()` (mismo codificador mínimo del paso 13) y `iniciarSesionComo(page, rol)`.
- `tests/e2e/flujos.spec.ts` — los 4 flujos de §13 (*Critical flows*), cada uno en su `test()`
  con datos propios; las descargas se verifican con `page.waitForEvent("download")` y los
  primeros 5 bytes `%PDF-`.
- `tests/e2e/responsive.spec.ts` — barrido de todas las páginas principales: las del paso 10 más
  `/mi-cuenta/portafolio`, `/mi-cuenta/solicitudes/<id>` de una solicitud creada en el
  `beforeAll`, `/asesor`, `/asesor/solicitudes`, `/asesor/solicitudes/<id>`, `/asesor/clientes`,
  `/coordinador/importar`, `/gerencia`, `/admin/staff` (cada una con el rol que la ve).
- `tests/integration/endurecimiento.test.ts` — importa `next.config.ts` y comprueba las 6
  cabeceras y `frame-ancestors 'none'`; 11 registros desde la misma IP → el 11.º 429
  `LIMITE_EXCEDIDO`; ningún `console.log` en `src/` (lectura estática de archivos con
  `node:fs`, excluido `src/components/ui`).
- `pnpm format`.

**Done when**
- [ ] WHEN `pnpm e2e tests/e2e/flujos.spec.ts` se ejecuta THE SYSTEM SHALL pasar los 4 flujos: registro por OTP con consentimiento y envío; aprobación por el asesor con PDFs descargables por el cliente; carga de fotos firmadas, aceptación, envío y constitución visible en el portafolio; edición posterior a la aprobación que crea la versión 2, desactualiza el firmado y vuelve a `pendiente_firma`.
- [ ] WHEN el servidor standalone de producción recibe `POST /api/test/login` THE SYSTEM SHALL responder 404 aunque `AUTH_TEST_LOGIN` valga 1.
- [ ] WHEN se lee la configuración de `next.config.ts` THE SYSTEM SHALL declarar para todas las rutas `Content-Security-Policy` con `frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options` en `nosniff`, `Referrer-Policy` en `strict-origin-when-cross-origin`, `X-Frame-Options` en `DENY` y `Permissions-Policy`.
- [ ] WHEN `pnpm e2e tests/e2e/responsive.spec.ts` se ejecuta THE SYSTEM SHALL no reportar desbordamiento horizontal en ninguna página principal de cliente y de staff a 375, 768 y 1440 px.
- [ ] WHEN `POST /api/v1/auth/registro` se llama 11 veces desde la misma IP en 15 minutos THE SYSTEM SHALL responder 429 con código `LIMITE_EXCEDIDO` en la undécima.

**Verify**
```bash
pnpm exec playwright install chromium                   # expect: exit 0
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test                                               # expect: exit 0, 0 failed — toda la suite
pnpm test tests/integration/endurecimiento.test.ts      # expect: exit 0, 0 failed
pnpm e2e tests/e2e/flujos.spec.ts                       # expect: exit 0, 0 failed
pnpm e2e tests/e2e/responsive.spec.ts                   # expect: exit 0, 0 failed
pnpm build                                              # expect: exit 0
sh scripts/smoke-standalone.sh /api/test/login NO_ENCONTRADO 404 POST   # expect: exit 0 — 404 en producción
status=0; grep -rnE '\.(skip|only)\(' tests || status=$?; test "$status" -eq 1
                                                        # expect: exit 0 — 1 = ninguna prueba saltada/enfocada · 2 = error de grep, y eso falla
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
```

**Checkpoint**
```bash
git add -A && git commit -m "step 19: endurecimiento y e2e de los 4 flujos"
git tag step-19-endurecimiento
```

---

#### Step 20 — Contenedor, CI y lista de lanzamiento

**Do**
`.github/workflows/ci.yml` ya existe (workspace, §19.6). Archivos:
- `.dockerignore` — **antes** de la primera `docker build`:
  ```
  .git
  .next
  node_modules
  .data
  .env
  .env.*
  blueprints
  .claude
  docs
  tests
  coverage
  playwright-report
  test-results
  ```
- `Dockerfile`:
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
  (`assets/` se copia porque el motor PDF lee `process.cwd()/assets/formatos`; las migraciones no
  viajan en la imagen: se aplican como paso de release, §12.)
- `scripts/smoke-docker.sh`:
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
- `docs/lanzamiento.md` — la lista de §20.1 (puntos manuales) y el bloque de comandos `az` de §12,
  copiados tal cual, más el procedimiento de release (§12 *Release and rollback*).
- `tests/unit/ci.test.ts` — lectura estática con `node:fs`: `ci.yml` contiene
  `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`,
  `pnpm db:test:prepare`, `pnpm test`, `pnpm build`, `pnpm e2e` y `postgres:17-alpine`;
  `.dockerignore` tiene las líneas `blueprints`, `.env`, `.data`, `node_modules` y `.next`;
  `Dockerfile` contiene `node:24.22.2-bookworm-slim` y `USER nextjs`; `docs/lanzamiento.md`
  contiene `az postgres flexible-server create` y `pnpm db:migrate`.
- `pnpm format`.

**Done when**
- [ ] WHEN `docker build -t corban-cdt:local .` se ejecuta THE SYSTEM SHALL terminar con código 0 usando la imagen base `node:24.22.2-bookworm-slim` y un usuario no root.
- [ ] WHEN `sh scripts/smoke-docker.sh` arranca la imagen en el puerto 3300 THE SYSTEM SHALL responder `GET /api/health` con 200 y `status` en `ok`, y detener el contenedor.
- [ ] WHEN `pnpm test tests/unit/ci.test.ts` se ejecuta THE SYSTEM SHALL confirmar que `.github/workflows/ci.yml` ejecuta `pnpm install --frozen-lockfile`, `pnpm exec biome ci .`, `pnpm typecheck`, `pnpm db:test:prepare`, `pnpm test`, `pnpm build` y `pnpm e2e` con un servicio `postgres:17-alpine`.
- [ ] WHEN `pnpm test tests/unit/ci.test.ts` lee `.dockerignore` THE SYSTEM SHALL encontrar las exclusiones `blueprints`, `.env`, `.data`, `node_modules` y `.next`.
- [ ] WHEN `pnpm test tests/unit/ci.test.ts` lee `docs/lanzamiento.md` THE SYSTEM SHALL encontrar el comando `az postgres flexible-server create` y el paso de release `pnpm db:migrate`.

**Verify**
```bash
pnpm test tests/unit/ci.test.ts                         # expect: exit 0, 0 failed
docker build -t corban-cdt:local .                      # expect: exit 0
sh scripts/smoke-docker.sh                              # expect: exit 0 — EJECUTA la imagen
pnpm typecheck                                          # expect: exit 0
pnpm lint                                               # expect: exit 0
```

Desplegar en Azure (cuentas, credenciales, DNS) no es un gate: es la lista de lanzamiento de §20.1.

**Checkpoint**
```bash
git add -A && git commit -m "step 20: contenedor, ci y lista de lanzamiento"
git tag step-20-contenedor-ci
git ls-files --error-unmatch Dockerfile .dockerignore docs/lanzamiento.md   # expect: exit 0
```

---

### 9.1 Parity and cutover

NOT APPLICABLE — greenfield build, no system is being replaced. (El POC estático no es un
sistema en producción: queda como referencia en `docs/poc/app.reference.js.txt`; sus algoritmos se
portan y prueban en los pasos 7 y 11.)

---

## 10. Environment Setup

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Node.js | 24.22.2 (línea 24 LTS; `.nvmrc` = `24`) | `node -v` → `v24.x` |
| corepack | el que trae Node 24 (Bootstrap usa npm si falta) | `corepack --version` |
| pnpm | 12.16.1 (lo activa Bootstrap; `packageManager` en `package.json`) | `pnpm --version` → `12.16.1` |
| Git | ≥ 2.28 (`git init -b`) | `git --version` |
| Docker + Docker Compose v2 | Compose con `up --wait` (≥ 2.1) | `docker compose version` |
| curl | cualquiera | `curl --version` |
| Librerías del sistema para Chromium (Linux) | las que instale Playwright | `sudo pnpm exec playwright install-deps chromium` una vez, antes del paso 8 |

El puerto 5432 debe estar libre (Postgres de compose) y también 3100 (smoke standalone), 3200
(E2E) y 3300 (smoke Docker).

### Accounts to create first

Ningún paso de §9 necesita cuentas externas: todo corre en local (Postgres en Docker, correo a
archivo, almacenamiento en disco, sesión de staff por `/api/test/login`). Para el lanzamiento
(§20.1), antes de la primera publicación:

| Cuenta / recurso | Dónde | Lo usa |
|---|---|---|
| Suscripción de Azure con permiso para crear recursos | https://portal.azure.com | §12 (App Service, PostgreSQL Flexible, Storage, Communication Services) |
| Registro de aplicación en Entra ID del tenant de Corban | https://entra.microsoft.com → App registrations | `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID` |
| Dominio de correo verificado en Azure Communication Services (o dominio administrado de Azure) | Portal de Azure → Communication Services → Email | `MAIL_FROM`, `ACS_CONNECTION_STRING` |
| Repositorio en GitHub con Actions habilitado | https://github.com | `.github/workflows/ci.yml` |

### Environment variables

| Variable | Purpose | Where to get it | Required by step | Secret? |
|---|---|---|---|---|
| `DATABASE_URL` | Conexión a Postgres de la app y de `pnpm db:*`. Local: `postgres://corban:corban@localhost:5432/corban` | Local: `.env.example`. Prod: cadena del Flexible Server con `?sslmode=require` | 2 | sí (en prod) |
| `TEST_DATABASE_URL` | Base de pruebas que recrea `pnpm db:test:prepare`. Local: `postgres://corban:corban@localhost:5432/corban_test` | `.env.example` | 2 | no |
| `ADMIN_EMAIL` | Primer admin del staff que crea `pnpm db:seed` | Correo M365 del administrador de Corban | 3 | no |
| `BETTER_AUTH_SECRET` | Firma de cookies y tokens de better-auth (≥ 32 caracteres; lo exige `getAuth()`) | Local: `.env.example`. Prod: `openssl rand -base64 48` guardado en App Settings | 5 | sí |
| `BETTER_AUTH_URL` | URL pública base y origen de confianza. Local: `http://localhost:3000` (E2E la sobreescribe a `http://127.0.0.1:3200`) | URL de App Service o dominio propio | 5 | no |
| `AUTH_TEST_LOGIN` | `1` habilita `/api/test/login` fuera de producción; en producción no tiene efecto | `.env.example` = `1`; prod `0` | 5 | no |
| `MAIL_DRIVER` | `file` · `smtp` · `acs` (defecto `file`) | `.env.example`; prod `acs` | 5 | no |
| `MAIL_FILE_DIR` | Carpeta del driver `file` (defecto `.data/mail`) | `.env.example` | 5 | no |
| `MAIL_FROM` | Remitente | `"Corban FC <no-responder@corbanfc.com>"`; prod: dirección verificada en ACS | 5 | no |
| `SMTP_HOST` / `SMTP_PORT` | Mailpit local (perfil `correo` de compose) | `localhost` / `1025` | 5 (solo con `smtp`) | no |
| `ACS_CONNECTION_STRING` | Azure Communication Services Email | Portal → recurso ACS → Keys | lanzamiento (obligatoria con `MAIL_DRIVER=acs`) | sí |
| `ENTRA_CLIENT_ID` / `ENTRA_CLIENT_SECRET` / `ENTRA_TENANT_ID` | Proveedor Microsoft del staff; sin las tres, el proveedor no se registra | Entra → App registrations → la app → Overview / Certificates & secrets | lanzamiento | sí (el secreto) |
| `STORAGE_DRIVER` | `fs` · `azure` (defecto `fs`) | `.env.example`; prod `azure` | 12 | no |
| `STORAGE_FS_ROOT` | Raíz del driver `fs` (defecto `.data/storage`) | `.env.example` | 12 | no |
| `AZURE_STORAGE_ACCOUNT` | Cuenta de Storage (identidad administrada + SAS de delegación) | Nombre de la cuenta creada en §12 | lanzamiento (obligatoria con `azure` si no hay cadena) | no |
| `AZURE_STORAGE_CONTAINER` | Contenedor privado (defecto `documentos`) | §12 | lanzamiento | no |
| `AZURE_STORAGE_CONNECTION_STRING` | Alternativa con clave de cuenta (Azurite o soporte) | Portal → Storage → Access keys | opcional | sí |
| `LOG_LEVEL` | `debug` · `info` · `warn` · `error` (defecto `info`) | `.env.example` | 4 | no |
| `NEXT_TELEMETRY_DISABLED` | Desactiva la telemetría de Next | `.env.example` = `1` | 1 | no |

`.env.example` está commiteado con cada clave y valores locales que funcionan con compose (ninguno
es un secreto de producción). `.env` y `.env.*` están en `.gitignore` (con la excepción
`!.env.example`). La aplicación valida en `getEnv()` en el primer uso y falla con el nombre de la
variable; los secretos nunca tienen valor por defecto en el código.

**Carga del entorno por herramienta** (Next lee `.env` solo para la app): scripts de
`package.json` (`db:*`) → `dotenv -e .env --` en el propio script; `drizzle.config.ts`,
`playwright.config.ts`, `tests/setup.ts` y `tests/e2e/preparar.ts` → `process.loadEnvFile(".env")`
al inicio del archivo; servidor standalone → `node --env-file-if-exists=.env` dentro de
`scripts/smoke-standalone.sh`; CI → bloque `env:` del job. Detalle en §19.6.

### Files that must be committed

| File | Why it is committed | Ignore-file exception line |
|---|---|---|
| `.env.example` | Plantilla de entorno que Bootstrap copia | `!.env.example` después de `.env.*` en `.gitignore` |
| `pnpm-lock.yaml` | Instalaciones reproducibles (`--frozen-lockfile` en CI y Docker) | — no lo cubre ningún patrón |
| `drizzle/**` | Migraciones aplicadas en orden en todos los entornos | — no lo cubre ningún patrón |
| `tests/unit/__snapshots__/pdf-*.json` | Contrato golden de los 6 PDF | — no lo cubre ningún patrón |
| `.claude/**`, `CLAUDE.md`, `AGENTS.md` | Configuración del agente | — no lo cubre ningún patrón |
| `.github/workflows/ci.yml` | CI | — no lo cubre ningún patrón |
| `assets/formatos/**`, `src/app/fonts/**`, `public/logo.png` | Insumos binarios del cliente | — no lo cubre ningún patrón |
| `docs/**` | Referencia del POC, contratos y lista de lanzamiento | — no lo cubre ningún patrón |
| `blueprints/corban-portal-cdt/**` | El bundle (incluye el estado de `tasks.json`) | — no lo cubre ningún patrón |
| `scripts/**`, `docker-compose.yml`, todos los configs de §19.6 | Infraestructura de los gates | — no lo cubre ningún patrón |

El `.gitignore` con esa excepción llega con la copia del workspace, **antes** del primer commit.

### Bootstrap

Se ejecuta desde la raíz del proyecto con el bundle en `blueprints/corban-portal-cdt/`. El mismo
contenido queda en `scripts/bootstrap.sh` para reejecutarlo con un solo comando. No necesita
Docker: Postgres se levanta en el `Verify` del paso 2.

```bash
#!/bin/sh
set -eu

BUNDLE=blueprints/corban-portal-cdt

# order matters: copia del workspace (trae .gitignore con sus excepciones, biome.json con sus
# exclusiones y pnpm-workspace.yaml) → .env desde la plantilla → repo git → primer commit
# → toolchain (corepack/pnpm) → pnpm install. El .gitignore existe ANTES del primer commit.

# 1. Copia NO destructiva del workspace: solo crea archivos que aún no existen.
#    Portable (GNU y BSD) y sale 0 cuando salta: no usa `cp -n` (en BSD sale 1 al saltar) ni
#    rsync (puede no estar instalado). Nunca sobrescribe package.json, pnpm-lock.yaml ni ningún
#    archivo que un paso haya editado.
(cd "$BUNDLE/workspace" && find . -type f) | while IFS= read -r f; do
  [ -e "$f" ] || { mkdir -p "$(dirname "$f")" && cp -p "$BUNDLE/workspace/$f" "$f"; }
done

# 2. .env local desde la plantilla; nunca se sobrescribe uno existente.
[ -e .env ] || cp .env.example .env

# 3. Repositorio propio del proyecto (no se asume que exista), identidad local si falta,
#    y un primer commit para que los tags de Checkpoint tengan a qué apuntar.
[ -d .git ] || git init -b main
git config user.email >/dev/null || git config user.email "constructor@corbanfc.local"
git config user.name >/dev/null || git config user.name "Constructor Corban CDT"
git rev-parse --verify -q HEAD >/dev/null || { git add -A && git commit -q -m "chore: bootstrap del workspace"; }

# 4. Toolchain: pnpm 12.16.1. `corepack enable` sin directorio falla con EACCES donde el bin
#    global no es escribible; se usa un directorio del usuario. Sin corepack (Node >= 25), npm.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
mkdir -p "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
if command -v corepack >/dev/null 2>&1; then
  corepack enable --install-directory "$HOME/.local/bin"
  corepack prepare pnpm@12.16.1 --activate
else
  npm install -g --prefix "$HOME/.local" pnpm@12.16.1
fi
pnpm --version

# 5. Dependencias. La primera vez crea pnpm-lock.yaml (el paso 1 lo commitea); CI usa
#    --frozen-lockfile. pnpm install no reescribe package.json.
pnpm install
```

Qué hace una segunda ejecución, línea por línea: la copia no crea nada y sale 0; `.env` ya existe
(sale 0); `.git` existe; `git config` encuentra la identidad; `HEAD` existe y no hay commit nuevo;
corepack reescribe sus shims (sale 0); `pnpm install` con lockfile no cambia nada. Ningún archivo
emitido se revierte. Si `pnpm install` termina con `ERR_PNPM_IGNORED_BUILDS`, añade a
`pnpm-workspace.yaml` el paquete que nombra el error con valor `false` y vuelve a ejecutar.

**Arranque diario después del paso 3** (no es Bootstrap):

```bash
docker compose up -d --wait postgres   # o pnpm services:up
pnpm db:migrate
pnpm db:seed:demo                       # condiciones DEMO para probar el asistente en local
pnpm dev                                # http://localhost:3000 · staff local: POST /api/test/login {"email":"<ADMIN_EMAIL>"}
```

Bajar servicios: `pnpm services:down`. Reiniciar la base local desde cero (destructivo, solo
local): `pnpm services:reset`.

---

## 11. Dependencies

Fuente única de versiones. Procedencia: informe `stack-researcher` de esta sesión, ejecutado como
`npm view <paquete> dist-tags` el **2026-11-03** contra `https://registry.npmjs.org/<paquete>`.
Todas las dependencias de `package.json` las instala `pnpm install` en §10 Bootstrap (el
manifiesto se escribe completo desde el inicio; ningún paso hace `pnpm add` salvo shadcn en el
paso 8). Pines exactos (sin `^`), excepto `typescript` con `~` deliberado.

### Runtime

| Package | Version | Source (registry URL or track file) | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| node | 24.22.2 | VERIFIED vía el mapa de tiempos del paquete `node` en https://registry.npmjs.org/node (nodejs.org/dist/index.json no era accesible) | 2026-11-03 | §10 Prerequisites (lo instala el desarrollador) | Runtime; línea 24 LTS en mantenimiento. 26.13.0 descartado para App Service |
| next | 16.4.5 | https://registry.npmjs.org/next | 2026-11-03 | §10 Bootstrap — `pnpm install` | Framework (App Router, standalone, proxy.ts); engines node ≥ 20.9.0 |
| react | 19.3.1 | https://registry.npmjs.org/react | 2026-11-03 | §10 Bootstrap — `pnpm install` | UI |
| react-dom | 19.3.1 | https://registry.npmjs.org/react-dom | 2026-11-03 | §10 Bootstrap — `pnpm install` | UI |
| drizzle-orm | 0.45.4 | https://registry.npmjs.org/drizzle-orm | 2026-11-03 | §10 Bootstrap — `pnpm install` | ORM (línea 0.x estable; 1.0 es beta/rc: nunca `^1`) |
| postgres | 3.4.9 | https://registry.npmjs.org/postgres | 2026-11-03 | §10 Bootstrap — `pnpm install` | Driver; 4.0.0 (latest, publicado 2026-10-29) no se elige por ser demasiado nuevo; drizzle pide ≥ 3 |
| better-auth | 1.7.16 | https://registry.npmjs.org/better-auth | 2026-11-03 | §10 Bootstrap — `pnpm install` | Auth (peers next 14–16, react 18–19, drizzle-orm ^0.45.2). Exports verificados: `./plugins`, `./plugins/email-otp`, `./adapters/drizzle`, `./social-providers`. Claves `socialProviders.microsoft` (`clientId`, `clientSecret`, `tenantId`) **UNVERIFIED — verify before install** |
| zod | 4.6.7 | https://registry.npmjs.org/zod | 2026-11-03 | §10 Bootstrap — `pnpm install` | Validación en env, API y formularios |
| react-hook-form | 7.91.0 | https://registry.npmjs.org/react-hook-form | 2026-11-03 | §10 Bootstrap — `pnpm install` | Formularios del asistente |
| @hookform/resolvers | 7.0.2 | https://registry.npmjs.org/@hookform/resolvers | 2026-11-03 | §10 Bootstrap — `pnpm install` | `zodResolver` (peer zod ^3.25 ∥ ^4, react-hook-form ^7.55) |
| @tanstack/react-query | 5.105.3 | https://registry.npmjs.org/@tanstack/react-query | 2026-11-03 | §10 Bootstrap — `pnpm install` | Estado de servidor del área de cliente |
| pdf-lib | 1.17.1 | https://registry.npmjs.org/pdf-lib | 2026-11-03 | §10 Bootstrap — `pnpm install` | Motor PDF y unión de fotos. Último publish 2022: estable pero sin mantenimiento — riesgo aceptado, aislado en `src/server/pdf` |
| exceljs | 4.4.0 | https://registry.npmjs.org/exceljs | 2026-11-03 | §10 Bootstrap — `pnpm install` | Importación y exportación .xlsx (último publish 2024-12) |
| @azure/storage-blob | 12.34.0 | https://registry.npmjs.org/@azure/storage-blob | 2026-11-03 | §10 Bootstrap — `pnpm install` | Driver de almacenamiento `azure` |
| @azure/identity | 4.14.1 | https://registry.npmjs.org/@azure/identity | 2026-11-03 | §10 Bootstrap — `pnpm install` | `DefaultAzureCredential` (identidad administrada) |
| @azure/communication-email | 1.1.0 | https://registry.npmjs.org/@azure/communication-email | 2026-11-03 | §10 Bootstrap — `pnpm install` | Driver de correo `acs` |
| recharts | 3.10.1 | https://registry.npmjs.org/recharts | 2026-11-03 | §10 Bootstrap — `pnpm install` | Gráficos de reportes (peer `react-is`: lo instala pnpm automáticamente, versión sin verificar) |
| nodemailer | 10.3.1 | https://registry.npmjs.org/nodemailer | 2026-11-03 | §10 Bootstrap — `pnpm install` | Driver de correo `smtp` (solo local) |

### Development

| Package | Version | Source (registry URL or track file) | Checked | Installed by | Purpose |
|---|---|---|---|---|---|
| pnpm | 12.16.1 | https://registry.npmjs.org/pnpm | 2026-11-03 | §10 Bootstrap — `corepack prepare pnpm@12.16.1 --activate` | Gestor de paquetes (también en `packageManager`) |
| typescript | ~6.0.3 | https://registry.npmjs.org/typescript | 2026-11-03 | §10 Bootstrap — `pnpm install` | Tipos; `latest` es 7.0.2 y no se usa |
| @types/react | 19.3.0 | https://registry.npmjs.org/@types/react | 2026-11-03 | §10 Bootstrap — `pnpm install` | Tipos |
| @types/react-dom | 19.3.0 | https://registry.npmjs.org/@types/react-dom | 2026-11-03 | §10 Bootstrap — `pnpm install` | Tipos |
| @types/node | 24.19.2 | https://registry.npmjs.org/@types/node | 2026-11-03 | §10 Bootstrap — `pnpm install` | Tipos de la línea 24 (latest es 26.x) |
| @types/nodemailer | 8.0.2 | https://registry.npmjs.org/@types/nodemailer | 2026-11-03 | §10 Bootstrap — `pnpm install` | Tipos |
| tailwindcss | 4.3.4 | https://registry.npmjs.org/tailwindcss | 2026-11-03 | §10 Bootstrap — `pnpm install` | Estilos |
| @tailwindcss/postcss | 4.3.4 | https://registry.npmjs.org/@tailwindcss/postcss | 2026-11-03 | §10 Bootstrap — `pnpm install` | Integración PostCSS |
| drizzle-kit | 0.31.11 | https://registry.npmjs.org/drizzle-kit | 2026-11-03 | §10 Bootstrap — `pnpm install` | `pnpm db:generate` |
| vitest | 5.1.0 | https://registry.npmjs.org/vitest | 2026-11-03 | §10 Bootstrap — `pnpm install` | Unitarias e integración (engines node ^22.12 ∥ ^24 ∥ ≥ 26) |
| @vitest/coverage-v8 | 5.1.0 | https://registry.npmjs.org/@vitest/coverage-v8 | 2026-11-03 | §10 Bootstrap — `pnpm install` | Cobertura (`pnpm test --coverage` a demanda; no es gate) |
| @playwright/test | 1.64.1 | https://registry.npmjs.org/@playwright/test | 2026-11-03 | §10 Bootstrap — `pnpm install`; navegador: paso 8 `pnpm exec playwright install chromium` | E2E |
| @biomejs/biome | 2.6.4 | https://registry.npmjs.org/@biomejs/biome | 2026-11-03 | §10 Bootstrap — `pnpm install` | Lint y formato (2.6 es nuevo; config mínima con `$schema` 2.6.4) |
| tsx | 4.23.15 | https://registry.npmjs.org/tsx | 2026-11-03 | §10 Bootstrap — `pnpm install` | Ejecuta `scripts/*.ts` con alias de tsconfig |
| dotenv-cli | 11.1.0 | https://registry.npmjs.org/dotenv-cli | 2026-11-03 | §10 Bootstrap — `pnpm install` | `dotenv -e .env --` en los scripts `db:*` |
| shadcn (CLI) | 4.23.0 | https://registry.npmjs.org/shadcn | 2026-11-03 | paso 8 — `pnpm dlx shadcn@4.23.0 init …` y `add …` | Copia componentes; no queda como dependencia |
| Dependencias que añade shadcn: `radix-ui` / `@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css` | sin pin (las elige el CLI; quedan en el lockfile) | UNVERIFIED — verify before install | — | paso 8 — `shadcn init` / `shadcn add` | Primitivas de UI |
| Imagen `postgres:17-alpine` | 17-alpine | UNVERIFIED — verify before install (Docker Hub no era accesible) | — | `docker-compose.yml` (§19.6) y `ci.yml` | Postgres local y de CI |
| Imagen `node:24.22.2-bookworm-slim` | 24.22.2-bookworm-slim | UNVERIFIED — verify before install | — | `Dockerfile` (paso 20) | Base de la imagen de producción |
| Imagen `axllent/mailpit` | latest (sin pin) | UNVERIFIED — verify before install | — | `docker-compose.yml` perfil `correo` | Correo SMTP local opcional |
| Acciones `actions/checkout`, `pnpm/action-setup`, `actions/setup-node`, `actions/upload-artifact` | v4 | UNVERIFIED — verify before install (GitHub no consultado) | — | `.github/workflows/ci.yml` (§19.6) | CI |

### Deliberately not used

| Rejected | Instead | Why |
|---|---|---|
| CLI `auth` / `@better-auth/cli` | Tablas de better-auth escritas a mano en `schema.ts` | Interactivo, más dependencias y un segundo generador de esquema; las 4 tablas son estables y el paso 5 las ejercita |
| `server-only` | Regla de frontera + Next falla si un componente cliente importa `postgres` | Lanza al importarse fuera de la condición `react-server`: rompería Vitest y los scripts sin alias extra |
| Prisma | Drizzle | Cliente generado y motor extra sin beneficio para este tamaño |
| ESLint + Prettier | Biome | Una herramienta, un config |
| `middleware.ts` | `src/proxy.ts` | Renombrado en Next 16 |
| `@tailwindcss/turbopack` | `@tailwindcss/postcss` | No funciona con el respaldo `--webpack` |
| TypeScript 7 | ~6.0.3 | Sin API de compilador estable para el tooling |
| postgres 4.0.0, drizzle 1.0 rc | 3.4.9, 0.45.4 | Demasiado nuevo / prerelease |
| `Intl.NumberFormat` para dinero en PDF | `formatoMiles` propio | No depender de los datos ICU del runtime en un golden |
| next-pwa / service worker | `manifest.ts` | v1 sin offline ni push |
| next-themes | — | Solo modo claro |
| Librerías de fechas (dayjs, date-fns) | Aritmética UTC propia en el motor | Cálculo pequeño, probado con fixtures; una dependencia menos |
| jsdom / Testing Library | Playwright para UI | La UI se prueba en el navegador real; Vitest queda para lógica y API |
| Redis / colas | Tabla `rate_limits` en Postgres, envío de correo al cerrar la transición | Un solo servicio de estado para el piloto |

---

## 12. Deployment Strategy

### Hosting

**Azure App Service for Linux, Web App for Containers, plan B1**, región **East US 2** (latencia
aceptable desde Colombia, disponibilidad completa de PostgreSQL Flexible, Storage y Communication
Services; no hay región de Azure en Colombia — la transferencia internacional de datos personales
se revisa con el área legal, §20.1). Imagen: la del `Dockerfile` del paso 20 (salida standalone,
`node server.js`, puerto 3000, `WEBSITES_PORT=3000`). Health check de App Service:
`/api/health/db`. **Base de datos:** Azure Database for PostgreSQL Flexible Server 17, Burstable
B1ms, 32 GB, TLS obligatorio (`?sslmode=require`), copias automáticas de 7 días. **Archivos:**
Storage Account StorageV2 LRS, TLS 1.2, acceso público a blobs deshabilitado, contenedor privado
`documentos`, la app accede con su identidad administrada (rol *Storage Blob Data Contributor*) y
emite SAS de delegación de usuario de 5 min. **Correo:** Communication Services Email.
**Identidad del staff:** registro de aplicación de Entra, audiencia "solo este directorio".

Comandos de aprovisionamiento (los ejecuta una persona con la suscripción; **no** son gates;
verificar cada flag con `az <comando> --help` antes de correrlo, porque la sesión de diseño no
consultó la CLI de Azure):

```bash
# Variables del operador (los secretos se exportan en la shell, nunca se escriben en el repo)
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

### Environments

| Environment | Branch | URL | Database | Third-party mode |
|---|---|---|---|---|
| Local | — | `http://localhost:3000` (E2E `http://127.0.0.1:3200`) | `corban` y `corban_test` en Docker | correo `file`, almacenamiento `fs`, staff por `/api/test/login` |
| CI | cualquier push/PR | — | servicio `postgres:17-alpine` del job | igual que local |
| Producción (piloto) | `main`, despliegue manual | `https://app-corban-cdt.azurewebsites.net` (dominio propio opcional) | Flexible Server `corban` | ACS, Blob privado, Entra; `AUTH_TEST_LOGIN=0` |

No hay entorno de preview en v1 (piloto, < 20 personas de staff): la verificación previa es CI +
la lista de §20.1.

### CI/CD

`.github/workflows/ci.yml` (§19.6), en cada push a `main` y en cada PR: `pnpm install
--frozen-lockfile` → `pnpm exec biome ci .` → `pnpm typecheck` → `pnpm db:migrate` →
`pnpm db:test:prepare` → `pnpm test` → `pnpm build` → smoke del standalone → `pnpm exec playwright
install --with-deps chromium` → `pnpm e2e`. Es el mismo conjunto que §20.1 salvo Docker (la imagen
se construye en la máquina del release). La publicación de la imagen (GHCR o ACR) y el despliegue
son manuales en v1.

### Release and rollback

1. `docker build -t "$IMAGEN" .` y `docker push "$IMAGEN"`.
2. **Migraciones primero, como paso de release** (nunca al arrancar): desde la máquina del
   operador con regla de firewall temporal, `DATABASE_URL="$DATABASE_URL_PROD" pnpm db:migrate`
   (`DATABASE_URL_PROD` = la cadena del Flexible Server con `?sslmode=require`, exportada en la
   shell del operador; nunca escrita en un archivo).
   Solo migraciones de expansión (§4); la contracción va en un release posterior.
3. `az webapp config container set --name "$APP" --resource-group "$GRUPO" --container-image-name "$IMAGEN"` y esperar el health check verde.
4. **Rollback:** volver a la etiqueta anterior con el mismo comando (≈ 2–5 min de reinicio del
   contenedor). Como las migraciones solo expanden, el código anterior sigue funcionando con el
   esquema nuevo. Restaurar la base (point-in-time restore del Flexible Server) solo ante
   corrupción de datos.

### Domain, DNS, TLS

v1 usa `*.azurewebsites.net` con TLS gestionado por Azure. Para un dominio propio (p. ej.
`cdt.corbanfc.com`): registro CNAME al host de App Service + TXT `asuid` de verificación,
certificado administrado gratuito de App Service, y actualizar `BETTER_AUTH_URL` y el redirect URI
de Entra. El botón de corbanfc.com apunta a `https://app-corban-cdt.azurewebsites.net/registro`
(o a `/registro` del dominio propio cuando exista).

---

## 13. Testing Strategy

| Layer | Framework | What it covers | Where | Runs |
|---|---|---|---|---|
| Unit | Vitest | Motor de cálculo y en letras, `can()` celda por celda, motor PDF y golden de los 6 formatos, contraste de tokens, contenido de CI/Docker | `tests/unit/` | cada commit (`pnpm test`) |
| Integration | Vitest contra Postgres real (`corban_test`) | Esquema y trigger de auditoría, auth (OTP, staff, test-login), API v1 y aislamiento, transiciones, firmas, edición/versiones, portafolio, importación, reportes, notificaciones, límites | `tests/integration/` | cada commit |
| E2E | Playwright (Chromium) contra `next dev` + `corban_test` | Los 4 flujos críticos y el barrido responsive | `tests/e2e/` | cada commit en CI; local en los pasos 8, 10 y 19 |

### Critical flows to cover E2E

1. **Registro y envío:** el cliente se registra por OTP (código leído de `.data/e2e-mail`), acepta
   el consentimiento, completa el asistente y envía → «Pendiente de validación».
2. **Aprobación y descarga:** el asesor (sesión por `/api/test/login`) aprueba → se generan los PDF
   → el cliente descarga cada formato y los bytes empiezan por `%PDF-`.
3. **Firma a constitución:** el cliente sube 2 fotos (PNG generados en la prueba) → el asesor
   acepta → marca enviada a la entidad → registra la constitución → el CDT aparece en
   `/mi-cuenta/portafolio` con su número.
4. **Edición posterior a la aprobación:** el asesor edita una solicitud en `firma_en_revision` con
   motivo → versión 2 → el firmado anterior aparece «Desactualizado» → estado «Pendiente de firma».

Más las pruebas de aislamiento (paso 9): cliente A recibe 404 por la solicitud de B en `/api/v1`;
un asesor recibe 404 por un cliente no asignado.

### Test data

- `pnpm db:test:prepare` borra y recrea `corban_test` y aplica todas las migraciones (servicio de
  §19.6, variable `TEST_DATABASE_URL`). `tests/setup.ts` fuerza `DATABASE_URL = TEST_DATABASE_URL`,
  almacenamiento en `.data/test-storage` y correo en `.data/test-mail`: las pruebas **nunca** tocan
  la base de desarrollo.
- Las pruebas no truncan ni dependen del orden: cada una crea sus filas con claves únicas
  (`crypto.randomUUID()`, plazos únicos en `crearCondicion`). Los archivos corren en serie
  (`fileParallelism: false`) porque comparten la base.
- E2E: `tests/e2e/preparar.ts` (globalSetup) recrea `corban_test`, corre `pnpm db:seed:demo` y
  `scripts/semilla-e2e.ts` (staff `asesor.e2e@…`, `asesor2.e2e@…`, `coordinador.e2e@…`,
  `gerencia.e2e@…`, `admin.e2e@…` de `corbanfc.com`), y limpia `.data/e2e-mail` y `.data/e2e-storage`.
- Fixtures: `tests/fixtures/cliente-ejemplo.json` (paso 11); imágenes y Excel se generan dentro de
  cada prueba, sin binarios en el repo.

### What is deliberately not tested

- El ingreso real con Entra ID, el driver `azure` contra una cuenta real y el envío real por ACS:
  necesitan credenciales; van en §20.1.
- La ubicación visual exacta del texto en los PDF: los golden verifican el valor de cada campo, no
  la posición; la revisión visual de los 6 PDF es un punto de §20.1.
- Navegadores distintos de Chromium y lectores de pantalla: pasada manual en §20.1.
- Carga/rendimiento: cientos de solicitudes al mes no lo justifican en v1.

---

## 14. Security & Secrets

| Concern | Control | Implemented in |
|---|---|---|
| Secret storage | App Settings de App Service (cifrados en reposo); nunca en el repo; `.env` ignorado | §12, `.gitignore` |
| Secret rotation | `BETTER_AUTH_SECRET` y secreto de Entra cada 12 meses o ante incidente (rotar el de better-auth cierra todas las sesiones); `ACS_CONNECTION_STRING` con regeneración de clave secundaria → primaria | Procedimiento en `docs/lanzamiento.md` |
| Input validation | zod en cada route handler, server action y en `env.ts`; tipo de archivo por bytes | `src/lib/datos/`, `src/server/authz/respuestas.ts`, `src/server/firmas/` |
| Output encoding / XSS | React escapa por defecto; prohibido `dangerouslySetInnerHTML` (salvo las plantillas de correo, que se construyen con escape explícito); CSP | componentes React, `src/server/correo/plantillas.ts`, `next.config.ts` (paso 19) |
| SQL injection | Solo consultas parametrizadas de drizzle/postgres; el único `unsafe` es el DDL de `db-test-prepare.ts` con nombre validado por regex | `src/server/**`, `scripts/db-test-prepare.ts` |
| AuthN / AuthZ | §8: sesión de better-auth, `can()` antes del trabajo en cada servicio, 404 para lo ajeno | `src/server/authz/`, `src/server/auth/` |
| CSRF | better-auth valida `Origin`; `exigirMismoOrigen()` en mutaciones propias; `SameSite=Lax`; server actions con verificación de origen de Next | `src/server/authz/respuestas.ts` |
| Rate limiting / abuse | §5 *Rate limits* (Postgres): OTP 5/correo y 20/IP por 15 min, registro 10/IP, carga 20/usuario/hora, 5 intentos por OTP; 429 + `Retry-After` | `src/server/auth/limite.ts`, `src/app/api/auth/[...all]/route.ts` |
| Webhook verification | NOT APPLICABLE: el sistema no recibe webhooks en v1 | — |
| Dependency audit | `pnpm audit --prod` mensual por el responsable técnico de Corban; vulnerabilidad alta → actualización en ≤ 7 días | `docs/lanzamiento.md` |
| Security headers | `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'` · `Strict-Transport-Security: max-age=63072000; includeSubDomains` · `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `X-Frame-Options: DENY` · `Permissions-Policy: camera=(self), microphone=(), geolocation=()` | `next.config.ts` (paso 19) |
| PII handling | Datos de identificación, contacto, laborales, financieros y cuenta bancaria en `clientes.perfil`/`solicitudes.datos` (Postgres cifrado en reposo por Azure) y PDFs en Blob privado (SAS de 5 min); TLS en tránsito; supresión: `deleted_at` a pedido del titular; retención: la fija el área legal (§20.1) | `src/server/**`, §12 |
| Logging hygiene | Logger JSON con redacción recursiva de documento, correo, celular, teléfonos, dirección, número de cuenta, OTP, tokens, cookies; prueba en el paso 4 | `src/lib/logger.ts` |

**Hard rules**
- Ningún secreto se commitea, se imprime en un log, viaja a un rastreador de errores ni entra en un
  bundle de cliente. Todo lo que llega al navegador es público.
- Toda autorización del servidor corre antes del trabajo, no después.
- Ningún archivo de cliente es público: ni `public/` ni contenedores con acceso anónimo.

**Régimen aplicable:** datos personales en Colombia — **Ley 1581 de 2012** y su reglamentación
(Decreto 1377 de 2013, compilado en el Decreto 1074 de 2015). Obligaciones que crea para este
build: autorización previa, expresa e informada, conservada como evidencia (tabla
`consentimientos` con versión, fecha, IP y user agent); finalidad declarada en el texto; acceso y
rectificación (el cliente ve y corrige sus datos; supresión a pedido); seguridad (cifrado,
mínimo privilegio, auditoría inmutable). Contexto SARLAFT: Corban recolecta datos de conocimiento
del cliente que entrega a entidades vigiladas por la Superintendencia Financiera; el sistema no
toma decisiones SARLAFT, pero conserva la trazabilidad de quién cambió qué (`audit_events`). El
texto del consentimiento y la política de retención requieren revisión legal antes del lanzamiento.

---

## 15. Accessibility

**Target: WCAG 2.2 Level AA.** Los criterios de accesibilidad están en los "Done when" de §9
(pasos 8, 10 y 19), no en un pendiente.

### Baseline requirements

| Requirement | Rule |
|---|---|
| Semantic HTML | `header`/`nav`/`main#contenido`/`footer` en cada shell, un `h1` por página, encabezados en orden, listas para listas, tablas con `th scope` |
| Keyboard | Todo operable con teclado, orden lógico, sin trampas; «Saltar al contenido» primer enfocable |
| Focus visible | Anillo `--color-ring` `#2E6DA4` de 2 px con 2 px de separación (5,47:1 sobre blanco) |
| Contrast | 4,5:1 texto, 3:1 texto grande y bordes de componentes — la paleta de §7 lo cumple y el paso 8 lo prueba |
| Forms | `label` en cada campo; error en texto junto al campo con `aria-describedby`; resumen con `role="alert"`; foco al primer campo inválido |
| Images | Logo con `alt="Corban FC"`; íconos decorativos `aria-hidden`; gráficos con tabla equivalente |
| Motion | Variantes `motion-reduce:` en toda transición |
| Zoom / reflow | Sin desplazamiento horizontal a 375 px (prueba) y a 320 px con zoom 200 % (pasada manual) |
| Live regions | «Guardado», resultados de carga y errores de envío en `aria-live="polite"` |

### WCAG 2.2 additions — the ones most often missed

| SC | Requirement |
|---|---|
| 2.4.11 Focus Not Obscured (Min) | La barra inferior móvil del cliente y los avisos no tapan el elemento enfocado (`scroll-padding-bottom` igual a su altura) |
| 2.5.7 Dragging Movements | No hay arrastre; la carga de archivos es por selector, no solo arrastrar y soltar |
| 2.5.8 Target Size (Min) | Cliente ≥ 44 × 44 px; staff ≥ 24 × 24 px con separación |
| 3.3.7 Redundant Entry | El perfil precarga cada nueva solicitud; los datos importados precargan el asistente |
| 3.3.8 Accessible Authentication (Min) | OTP con `autocomplete="one-time-code"`, pegar permitido, sin CAPTCHA |

### Verification

```bash
pnpm e2e tests/e2e/responsive.spec.ts   # expect: exit 0 — sin desbordamiento a 375/768/1440, lang es-CO, un h1, «Saltar al contenido» primero
pnpm test tests/unit/contraste.test.ts  # expect: exit 0 — todos los pares ≥ 4,5
pnpm lint                               # expect: exit 0 — incluye las reglas a11y recomendadas de Biome
```

No se usa axe en v1 (ningún paquete de axe se verificó en esta sesión); la cobertura automática es
la de arriba. Antes del lanzamiento: recorrido solo con teclado de los 4 flujos, una pasada con
lector de pantalla (NVDA o VoiceOver) del flujo del cliente y una pasada a 200 % de zoom en 320 px.

---

## 16. Observability & Cost

### Instrumentation

| Signal | Tool | What it captures | Who looks at it |
|---|---|---|---|
| Errors | Logger JSON (`nivel: "error"`) → log stream de App Service; Application Insights en la lista de lanzamiento | Excepciones no previstas con `requestId`, `actorId`, ruta; sin PII | Responsable técnico de Corban |
| Logs | `src/lib/logger.ts` → stdout → App Service log stream | Una línea JSON por evento con `requestId` (`x-request-id` o UUID) | Responsable técnico |
| Metrics | Consultas SQL sobre `solicitud_eventos`, `cdts` y `import_cargas` (reportes del paso 17) | Las de la tabla siguiente | Coordinador y gerencia |
| Uptime | Health check de App Service sobre `/api/health/db` (cada minuto, reinicia la instancia tras fallos) + alerta de disponibilidad de Azure Monitor (lista de lanzamiento) | Proceso vivo y base alcanzable | Responsable técnico |

### The metrics that matter for this project

| Metric | Target | Alert at |
|---|---|---|
| Disponibilidad de `/api/health/db` | ≥ 99,5 % mensual | 3 fallos seguidos (alerta de Azure Monitor) |
| Errores `nivel: "error"` por hora | < 5 | > 20 en una hora |
| Correos no enviados (`solicitud_eventos.notificado_at` nulo en eventos de más de 10 min) | 0 | ≥ 1 al día (consulta diaria del coordinador) |
| Mediana creación → `pendiente_validacion` | < 20 min | > 40 min en la semana |
| Promedio de días hasta `cdt_constituido` | < 7 | > 10 en el mes |

### Health check

`/api/health` (proceso vivo, sin base) y `/api/health/db` (`select 1` por el pool real; 503 si
falla). App Service sondea `/api/health/db`. No verifica migraciones pendientes: se aplican como
paso de release explícito (§12) y un esquema atrasado aparece como errores en el log.

### Cost model

Precios orientativos de lista (USD, East US 2) — **verificar en la calculadora de precios de Azure
antes de comprometer presupuesto**; la sesión de diseño no consultó precios.

| Service | Free tier | Cost at v1 scale (cientos de solicitudes/mes) | Cost at 10× | Cliff to watch |
|---|---|---|---|---|
| App Service B1 Linux | — | ≈ 13 | ≈ 13–55 (B1 → S1/P0v3 si la CPU no alcanza) | Generar PDFs concurrentes en B1 |
| PostgreSQL Flexible B1ms + 32 GB | 12 meses gratis en cuentas nuevas elegibles | ≈ 15–20 | ≈ 30–60 (B2s) | Conexiones (B1ms admite pocas; pool de 10) |
| Storage (PDFs, < 5 GB) | — | < 1 | ≈ 2 | Ninguno a esta escala |
| Communication Services Email | — | < 1 (≈ USD 0,00025 por correo) | ≈ 2 | Volumen de OTP abusivo (limitado por §5) |
| Entra ID | incluido en M365 | 0 | 0 | — |
| GitHub Actions | minutos gratis del plan | 0 | 0–10 | Minutos de E2E |

**Costo mensual estimado al lanzamiento: ≈ USD 30–35.** La línea más grande es PostgreSQL; la
palanca más barata es mantener B1ms mientras el piloto no supere ~10 usuarios concurrentes. Nada
escala de forma superlineal.

---

## 17. Model Routing

NOT APPLICABLE — this project does not call an LLM at runtime.

---

## 18. Skills to Use During Build

Nombres e instalación copiados de `knowledge/skills-registry.md`. Ninguno es obligatorio: si no
está instalado, el constructor sigue este blueprint, lo anota en una línea y continúa.

| Skill | Build steps | Why | Install |
|---|---|---|---|
| `frontend-design` (se activa sola, sin `/`) | 8, 10, 14, 17 | Shells, asistente, bandeja y reportes con calidad de producción dentro de los tokens de §7 | `/plugin marketplace add anthropics/skills` y luego `/plugin install example-skills@anthropic-agent-skills` |
| `playwright-cli` (se activa sola) | 8, 10, 19 | Depurar las specs E2E y el barrido responsive | `npm install -g @playwright/cli@latest` y luego `playwright-cli install --skills` |
| `pdf` (se activa sola) | 11, 13 | Inspeccionar los AcroForms y los PDF generados/unidos | `/plugin marketplace add anthropics/skills` y luego `/plugin install document-skills@anthropic-agent-skills` |
| `ui-ux-pro-max` (se activa sola) | 8 (solo si el cliente entrega la paleta oficial) | Reajustar tokens manteniendo el contraste | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` y luego `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |

Las skills propias del proyecto (`agregar-entidad`, `regenerar-golden`, `agregar-migracion`) viven
en `.claude/skills/` (§19.4) y no requieren instalación.

---

## 19. Agent Workspace

**Modo bundle:** cada artefacto de esta sección es un archivo real bajo
`blueprints/corban-portal-cdt/workspace/`, con la misma ruta que tendrá en el proyecto. **El
archivo en disco es la fuente**; esta sección lo describe y no repite su contenido, para que no
existan dos copias que diverjan.

```
blueprints/corban-portal-cdt/workspace/
├── CLAUDE.md · AGENTS.md                         # §19.1 · §19.2
├── .claude/settings.json                         # §19.3
├── .claude/skills/{agregar-entidad,regenerar-golden,agregar-migracion}/SKILL.md   # §19.4
├── .claude/rules/{server,api-v1,db,ui,pruebas}.md                                 # §19.5
├── package.json · pnpm-workspace.yaml · tsconfig.json · biome.json · next.config.ts
├── postcss.config.mjs · vitest.config.mts · playwright.config.ts · drizzle.config.ts
├── docker-compose.yml · .env.example · .gitignore · .nvmrc · .github/workflows/ci.yml
├── scripts/{bootstrap.sh,migrate.ts,db-test-prepare.ts,semilla-e2e.ts,smoke-standalone.sh}
├── src/lib/env.ts · src/app/{layout.tsx,globals.css,(publico)/page.tsx,api/health/route.ts}
├── tests/{setup.ts,unit/health.test.ts,e2e/preparar.ts}
├── docs/referencia/{esquema.ts.txt,contratos.md}                                  # contratos para los epics
├── docs/pruebas-pdf/                                                              # evidencia de la prueba de los 6 PDF (insumo)
└── (insumos ya presentes) assets/formatos/** · docs/poc/app.reference.js.txt · src/app/fonts/*.woff2 · public/logo.png
```

**La copia es una sola y no destruye nada.** El builder copia el **contenido** de `workspace/` a
la raíz con el bucle de §10 Bootstrap (paso 1): solo crea los archivos que faltan, es portable
(GNU y BSD) y **sale 0** cuando salta, así una segunda ejecución no revierte `package.json`,
`pnpm-lock.yaml` ni ningún archivo que un paso haya editado (`globals.css`, `layout.tsx`,
`next.config.ts`, `schema.ts`…). No se usa `cp -Rn` (en BSD/macOS sale 1 al saltar) ni `rsync`
(puede no estar instalado). Nada más del bundle se copia.

**Todo lo emitido pasa los gates del propio blueprint:** formato de Biome con espacios de 2 y
línea de 100 (`biome.json` emitido aquí es el config que gobierna — no hay scaffolder), comillas
dobles, punto y coma, comas finales. El paso 1 corre `pnpm format` una vez como red de seguridad.
Los archivos que Biome no formatea (`*.md`, `*.yml`, `*.yaml`, `.claude/**`, `docs/**`,
`tsconfig.json`, `assets/**`) están excluidos en `biome.json`, no en prosa.

**`.claude/commands/` no se emite.**

### 19.1 `CLAUDE.md`

`workspace/CLAUDE.md` (≈ 150 líneas, bajo el tope de 200): comandos primero, stack, ruta de una
petición, tabla de fronteras, fuentes únicas, 12 reglas de código, tokens de diseño literales,
entorno, tabla de reglas por área y 7 no negociables.

### 19.2 `AGENTS.md`

`workspace/AGENTS.md`: descripción, tabla de comandos, los mismos 7 no negociables y punteros a
`CLAUDE.md` y `docs/referencia/contratos.md`.

### 19.3 `.claude/settings.json`

`workspace/.claude/settings.json`. `permissions.allow` contiene una entrada exacta por cada
subcomando de cada `Verify` de §9 y de §20.1 (dividiendo en `&&`, `||`, `;`, `|`): los scripts
`pnpm` (`lint`, `typecheck`, `test` y `test:*`, `build`, `e2e` y `e2e:*`, `db:*`,
`services:up/down`, `format`, `install` y `install --frozen-lockfile`), `pnpm exec biome ci .`,
`pnpm exec playwright install chromium` (y `--with-deps`), `pnpm dlx shadcn@4.23.0 init:*` /
`add:*` (versión fija, no un comodín de `dlx`), `sh scripts/smoke-standalone.sh:*`,
`sh scripts/smoke-docker.sh`, `sh scripts/bootstrap.sh`, `docker compose up -d --wait postgres`,
`docker compose down`, `docker compose exec -T postgres psql:*`, `docker build -t corban-cdt:local .`,
`test:*` (para `test -f` y las aserciones `test "$status" -eq 1`), `grep:*`, `tail:*`,
`mkdir -p:*`, `cp .env.example .env`, `corepack …` y los `git` de solo lectura más `add -A`,
`commit`, `tag`, `init -b main`, `config user.*` y `checkout -- src/app/globals.css`. Ningún
intérprete suelto, ni `curl:*`, ni `npx:*`, ni `sh -c`. `deny`: `.env` y `.env.local/.production`,
`git push`, `docker compose down -v`, `pnpm services:reset`, `az:*` y `rm -rf:*` (los deny
desaniman, no aíslan: el aislamiento real es el sandbox).

### 19.4 Project skills — `.claude/skills/<name>/SKILL.md`

| Skill | Triggers on | What it automates |
|---|---|---|
| `agregar-entidad` | "agregar una entidad", "nuevo banco", "mapear un PDF nuevo" | PDF en `assets/formatos`, filas de mapeo, prefijo de nombre, `ENTIDADES_BASE`, golden nuevo, semilla |
| `regenerar-golden` | la prueba pdf-golden falla tras un cambio intencional de mapeo, derivación o fixture | Borra solo los snapshots afectados, los reescribe en local y los compara, revisión visual |
| `agregar-migracion` | "agregar una columna", "nueva tabla", "migración", "índice" | Edición de `schema.ts`, `db:generate` (o `--custom`), migrar, recrear `corban_test`, prueba de esquema |

### 19.5 `.claude/rules/*.md`

| File | `paths` globs | Covers |
|---|---|---|
| `.claude/rules/server.md` | `src/server/**` | `can()` primero, `filtroVisibilidad`, `conAuditoria`, `ejecutarTransicion`, motivo y diffs, efectos después del commit, errores de Postgres envueltos |
| `.claude/rules/api-v1.md` | `src/app/api/v1/**`, `src/app/api/staff/**` | Contrato versionado, sobre único, orden del handler, `request` en vez de `next/headers`, `params` como Promise, descargas y cargas |
| `.claude/rules/db.md` | `src/server/db/**`, `drizzle/**`, `scripts/**` | Esquema sin imports, migraciones nombradas por la herramienta, expandir/contraer, tipos de dinero y fecha, scripts con tsx |
| `.claude/rules/ui.md` | `src/app/**/*.tsx`, `src/components/**` | Solo tokens, frontera cliente/servidor, mobile-first, accesibilidad de formularios, estados vacíos |
| `.claude/rules/pruebas.md` | `tests/**` | Base de pruebas, datos únicos sin truncar, handlers con `Request`, OTP desde archivos, sin `.skip`/`.only` |

### 19.6 Verify-critical config and local infrastructure

| File | Path in the project | Which `Verify` commands need it | Resolution/env handling it carries | Bundle-path exclusion |
|---|---|---|---|---|
| Manifiesto | `package.json` | todos | scripts `db:*` con `dotenv -e .env --`; todas las dependencias fijadas (sin arrays: el formato no depende de la regla de expansión de Biome) | n/a — pnpm no recorre el árbol (no hay `packages:`) |
| Ajustes de pnpm | `pnpm-workspace.yaml` | Bootstrap `pnpm install` | solo `allowBuilds` (pnpm 12 rechaza otras claves) | n/a — sin `packages:`, el bundle no es un paquete del workspace |
| TypeScript | `tsconfig.json` | 1–20 (`typecheck`, `build`) | `moduleResolution: bundler`, `allowImportingTsExtensions`, `rewriteRelativeImportExtensions`, `paths @/* → ./src/*`, `types: ["node"]`, `noUncheckedSideEffectImports: false` (import de `globals.css`), `jsx: react-jsx` | `"exclude": [... "blueprints" ...]` |
| Biome | `biome.json` | 1–20 (`lint`) | `css.parser.tailwindDirectives: true`; lint apagado en `src/components/ui/**` (código generado) | `"!!**/blueprints"` en `files.includes` (además `!!**/node_modules`, `.next`, `.data`) |
| Next | `next.config.ts` | `build` | `output: "standalone"`, `outputFileTracingRoot` y `turbopack.root` = raíz del proyecto | n/a — Next solo enruta `src/app` |
| PostCSS | `postcss.config.mjs` | `build` | `@tailwindcss/postcss` | n/a para la config; `src/app/globals.css` lleva `@source not "../../docs";` y `@source not "../../blueprints";` para que la detección de Tailwind no lea `docs/` ni la copia de `docs/` dentro del bundle commiteado |
| Vitest | `vitest.config.mts` | 1–7, 9, 11–20 | alias `@` → `./src`; `setupFiles: ./tests/setup.ts`; archivos en serie | `exclude: ["blueprints/**", ...]` e `include` limitado a `tests/unit` y `tests/integration` |
| Setup de pruebas | `tests/setup.ts` | todas las de Vitest | `process.loadEnvFile(".env")`; `DATABASE_URL = TEST_DATABASE_URL`; `fs`/`file` en `.data/test-*` | n/a |
| Playwright | `playwright.config.ts` | 8, 10, 19 | `process.loadEnvFile(".env")`; `webServer` = `pnpm dev` en 127.0.0.1:3200 con `DATABASE_URL` de pruebas y `BETTER_AUTH_URL` del puerto | `testDir: ./tests/e2e` (nunca ve `blueprints/`) |
| globalSetup E2E | `tests/e2e/preparar.ts` | 8, 10, 19 | carga `.env`; pasa `DATABASE_URL = TEST_DATABASE_URL` a `db:test:prepare`, `db:seed:demo` y `semilla-e2e.ts` | n/a |
| drizzle-kit | `drizzle.config.ts` | 2, 3 (`db:generate`) | `process.loadEnvFile(".env")` + `dotenv -e .env --`; esquema sin imports del proyecto | n/a — ruta del esquema explícita |
| Servicios | `docker-compose.yml` | 2–19 | `postgres:17-alpine`, healthcheck `pg_isready`, volumen `pgdata`, puerto 5432; Mailpit en perfil `correo` | n/a |
| Entorno | `.env.example` → `.env` | todos los que leen entorno | valores locales literales | n/a |
| Ignorados | `.gitignore` | Bootstrap (primer commit) | `.env.*` + `!.env.example` | el bundle **no** se ignora: se commitea a propósito |
| Runtime | `.nvmrc` | CI | `24` | n/a |
| Scripts de BD | `scripts/migrate.ts`, `scripts/db-test-prepare.ts`, `scripts/semilla-e2e.ts` | 2–19 | leen el entorno que cargan `dotenv-cli` o `preparar.ts`; solo importan `postgres`/`drizzle-orm` | n/a |
| Smoke | `scripts/smoke-standalone.sh` | 1, 2, 18, 19, CI | `node --env-file-if-exists=.env`; `PORT=3100`, `HOSTNAME=127.0.0.1` | n/a |
| Bootstrap | `scripts/bootstrap.sh` | reejecución de §10 | — | n/a |
| Entorno de la app | `src/lib/env.ts` | 2–20 | validación perezosa (`getEnv()`) | n/a |
| App mínima | `src/app/layout.tsx`, `src/app/globals.css`, `src/app/(publico)/page.tsx`, `src/app/api/health/route.ts` | 1 (`build`, smoke) | `/api/health` sin base de datos | n/a |
| Prueba del paso 1 | `tests/unit/health.test.ts` | 1 | importa `@/app/api/health/route` | n/a |
| CI | `.github/workflows/ci.yml` | 20 (`tests/unit/ci.test.ts`), CI | bloque `env:` con todas las variables | n/a |
| Contratos | `docs/referencia/esquema.ts.txt`, `docs/referencia/contratos.md` | 3, 7, 9, 11, 12 (referencia de contenido) | — | excluidos de Biome (`!**/docs`) y de tsc (`"docs"`) |

**Servicio provisionado (cuatro partes):** `docker-compose.yml` con imagen fijada y healthcheck;
`DATABASE_URL`/`TEST_DATABASE_URL` en §10 con su valor local literal; `docker compose up -d --wait
postgres` (= `pnpm services:up`), `pnpm services:down` y `pnpm services:reset` en §10 y en
`CLAUDE.md`; up/down en `permissions.allow` (reset en `deny`).

#### Resolution convention matrix

**La convención, una sola vez:** los imports **relativos** llevan la **extensión explícita** (`.ts` / `.tsx`;
dentro de una carpeta, `./schema.ts`) y los imports con el alias **`@/` = `src/`** van **sin extensión**
(`import { getDb } from "@/server/db/client"`). TypeScript 6 rechaza un `.ts` en un import no relativo
(TS2877) y no lo reescribe al emitir, por eso el alias no lleva extensión. Los cargadores (resolución
`bundler`, alias de Next, Vitest y tsx) resuelven el alias sin extensión.

| Context | Command that exercises it | Convention as it appears there | Config + literal setting that makes it work |
|---|---|---|---|
| Application source | `pnpm build` (Turbopack) | `@/server/db/client`, `./paso-cdt.tsx` | `tsconfig.json` — `"moduleResolution": "bundler"`, `"paths": { "@/*": ["./src/*"] }`, `"allowImportingTsExtensions": true` |
| Type check | `pnpm typecheck` (`tsc --noEmit`) | igual | `tsconfig.json` — `"noEmit": true` (requisito de `allowImportingTsExtensions`), `"rewriteRelativeImportExtensions": true` |
| Test files | `pnpm test` (Vitest 5 / Vite) | igual | `vitest.config.mts` — `resolve.alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }`; Vite resuelve extensiones explícitas |
| Standalone scripts | `pnpm db:seed` → `tsx scripts/seed.ts` | `@/server/db/client` | tsx lee `paths` de `tsconfig.json`; los scripts usan `main().catch()` porque tsx los ejecuta como CommonJS (no hay `"type": "module"`) |
| Scripts sin imports del proyecto | `pnpm db:migrate` → `tsx scripts/migrate.ts` | solo paquetes | nada que resolver |
| drizzle-kit | `pnpm db:generate` | `schema.ts` sin imports del proyecto | `drizzle.config.ts` — `schema: "./src/server/db/schema.ts"` |
| E2E | `pnpm e2e` | `./apoyo.ts` (relativo con extensión), nunca `src/` | Playwright transpila TS y resuelve la ruta relativa existente; las specs no importan código de la app |
| Configuración de Next | `pnpm build` | `next.config.ts` importa solo `type NextConfig` | — |
| Servidor construido | `node .next/standalone/server.js` | JS emitido por Next | Next empaqueta; las extensiones `.ts` no llegan a la salida |

#### Cross-artifact value reconciliation

| Shared value | Single source — the file that decides it | Literal value | Every other place it appears | Compared |
|---|---|---|---|---|
| Entrada del build | `next.config.ts` — `output: "standalone"` | `.next/standalone/server.js` | `scripts/smoke-standalone.sh` · §9 paso 1 `test -f` · `Dockerfile` (copia `.next/standalone` → `server.js` en `CMD`) · §3 · §20.1 | yes |
| Puerto del smoke | `scripts/smoke-standalone.sh` — `SMOKE_PORT:-3100` | `3100` | §10 Prerequisites · §9 pasos 1, 2, 18, 19 | yes |
| Puerto E2E | `playwright.config.ts` — `PUERTO = 3200` | `3200` / `http://127.0.0.1:3200` | `webServer.command`, `webServer.url`, `BETTER_AUTH_URL` del `webServer.env` · §10 | yes |
| Puerto de la app | `Dockerfile` — `PORT=3000` | `3000` | `.env.example` `BETTER_AUTH_URL=http://localhost:3000` · `ci.yml` · §12 `WEBSITES_PORT=3000` · `scripts/smoke-docker.sh` `-p 3300:3000` | yes |
| Ruta de salud | `src/app/api/health/route.ts` | `/api/health` | `playwright.config.ts` `webServer.url` · smoke scripts · `ci.yml` | yes |
| Usuario/clave/base local | `docker-compose.yml` — `POSTGRES_USER/PASSWORD/DB` | `corban` / `corban` / `corban` | `.env.example` `DATABASE_URL` · `ci.yml` (servicio y `DATABASE_URL`) · `drizzle.config.ts` (respaldo) · healthcheck `pg_isready -U corban -d corban` · §9 `psql -U corban -d corban` | yes |
| Base de pruebas | `.env.example` — `TEST_DATABASE_URL` | `postgres://corban:corban@localhost:5432/corban_test` | `ci.yml` · `scripts/db-test-prepare.ts` (exige sufijo `_test`) · prueba del paso 2 (`/corban_test$`) | yes |
| Carpeta de migraciones | `drizzle.config.ts` — `out: "./drizzle"` | `drizzle` | `scripts/migrate.ts` y `scripts/db-test-prepare.ts` `migrationsFolder: "drizzle"` · `biome.json` `!**/drizzle` · §3 | yes |
| Ruta del esquema | `drizzle.config.ts` — `schema` | `./src/server/db/schema.ts` | §3 · §4 · pasos 2–3 | yes |
| Columnas de `staff_members` | `src/server/db/schema.ts` | `email, nombre, rol, activo` | `scripts/semilla-e2e.ts` (`insert into staff_members (email, nombre, rol, activo)`) | yes |
| Imagen de Postgres | `docker-compose.yml` | `postgres:17-alpine` | `ci.yml` · `tests/unit/ci.test.ts` · §11 | yes |
| Imagen base de Node | `Dockerfile` (paso 20) | `node:24.22.2-bookworm-slim` | `tests/unit/ci.test.ts` · §11 · paso 20 | yes |
| Versión de pnpm | `package.json` — `packageManager` | `pnpm@12.16.1` | §10 Bootstrap `corepack prepare pnpm@12.16.1` · `scripts/bootstrap.sh` · `ci.yml` (`pnpm/action-setup` lee `packageManager`) · Docker (corepack lo lee) | yes |
| Línea de Node | `.nvmrc` | `24` | `ci.yml` `node-version-file: .nvmrc` · Dockerfile `24.22.2` · §10 | yes |
| Nombre de la imagen local | §9 paso 20 | `corban-cdt:local` | `scripts/smoke-docker.sh` · `.claude/settings.json` · §20.1 | yes |
| Directorios del driver `file` | `.env.example` `MAIL_FILE_DIR` | `.data/mail` (dev) · `.data/test-mail` (Vitest) · `.data/e2e-mail` (E2E) | `tests/setup.ts` · `playwright.config.ts` · `tests/e2e/preparar.ts` · `.claude/rules/pruebas.md` | yes |
| Ruta del bundle | §10 Bootstrap `BUNDLE` | `blueprints/corban-portal-cdt` / `blueprints` | `biome.json` `!!**/blueprints` · `tsconfig.json` `exclude` · `vitest.config.mts` `exclude` · `.dockerignore` (paso 20) · `scripts/bootstrap.sh` · `src/app/globals.css` `@source not "../../blueprints"` | yes |
| Versión del consentimiento | `src/server/auth/actor.ts` — `export const VERSION_CONSENTIMIENTO` (paso 5) | `2026-11-v1` | `registrarConsentimiento()` del paso 6 (la importa, no la repite) · `docs/referencia/contratos.md` §8 · §4 | yes |

Cada contrato se ejerce en el primer paso donde existen ambos lados: la salida standalone y la ruta
de salud en el paso 1 (smoke real); usuario/base de compose ↔ `.env.example` ↔ migrador en el
paso 2 (`db:migrate` + smoke `/api/health/db`); columnas de `staff_members` ↔ `semilla-e2e.ts` en
el paso 8 (primer E2E); imagen de Node ↔ Dockerfile en el paso 20 (`docker build` + smoke).

#### Byte-exact artifact reconciliation

| Byte-exact artifact | Authored by | First diffed at | Blueprint rules that constrain it | Runtime call that produces it, on the §11 pin | Both confirmed |
|---|---|---|---|---|---|
| `tests/unit/__snapshots__/pdf-<docKey>.json` (6) | **los escribe Vitest** en la primera ejecución local del paso 11; el blueprint no dicta ningún byte | paso 11 (segunda ejecución) y todo `pnpm test` posterior | §5 *Motor PDF* (orden del algoritmo, `formatoMiles` sin `$`, `mismo()`, "X" en campos de texto) y fixture del paso 11 | `PDFTextField.getText()` / `PDFCheckBox.isChecked()` / `PDFRadioGroup.getSelected()` de pdf-lib 1.17.1 sobre los bytes generados | yes — no hay literal predicho; la revisión visual de los 6 PDF está en §20.1 |
| Fechas esperadas del motor (casos 1–7 del paso 7) | paso 7 (tabla del blueprint) | paso 7 | §5 *Motor de cálculo* (calendario, comercial 360 con tope a fin de mes, ajustes) | Aritmética propia con `Date.UTC`/`getUTCDay` (no depende de zona ni de ICU); días de la semana derivados de 2026-01-01 = jueves. Confirmación con un comando: `node -e 'for (const d of ["2026-03-01","2026-03-02","2026-05-31","2026-02-28","2026-06-01"]) console.log(d, new Date(d+"T00:00:00Z").getUTCDay())'` debe imprimir `0 1 0 6 1` | yes (calculado; comando de confirmación entregado) |
| `valorEnLetras` esperados (paso 7) | paso 7 | paso 7 | Port literal de `enLetras()` del POC (§5, `contratos.md` §4) | Código propio puro, sin cadenas del runtime | yes |
| `formatoMiles(50000000)` = `50.000.000`, `tasaTexto("10.5000")` = `10,50` | paso 7 | pasos 7 y 11 | §5: sin `$`, punto de miles, coma decimal | Código propio (no `Intl`) | yes |
| Cuerpos que buscan los smoke (`"status":"ok"`, `"db":"ok"`, `/mi-cuenta`, `NO_ENCONTRADO`, `PNG`) | §9 pasos 1, 2, 18, 19 | esos pasos | §5 (cuerpos de `/api/health`, `/api/health/db`, sobre de error) | `Response.json()` serializa con `JSON.stringify` sin espacios; el manifiesto y los íconos solo se comparan por subcadena | yes |

---

## 20. Acceptance Gate, Risks & Decision Log

### 20.1 Global acceptance gate

El proyecto está **terminado** cuando cada comando de abajo sale 0 en un checkout limpio (después
de §10 Bootstrap), y no antes. Es el mismo conjunto que corre CI más Docker.

```bash
pnpm install --frozen-lockfile                          # expect: exit 0, lockfile sin cambios
pnpm exec biome ci .                                    # expect: exit 0, 0 errores
pnpm typecheck                                          # expect: exit 0
docker compose up -d --wait postgres                    # expect: exit 0
pnpm db:migrate                                         # expect: exit 0
pnpm db:test:prepare                                    # expect: exit 0
pnpm test                                               # expect: exit 0, 0 failed
pnpm build                                              # expect: exit 0
sh scripts/smoke-standalone.sh /api/health '"status":"ok"'              # expect: exit 0 — ejecuta el artefacto construido
sh scripts/smoke-standalone.sh /api/test/login NO_ENCONTRADO 404 POST   # expect: exit 0 — 404 en producción
pnpm exec playwright install chromium                   # expect: exit 0
pnpm e2e                                                # expect: exit 0, 0 failed (incluye el barrido responsive/a11y)
docker build -t corban-cdt:local .                      # expect: exit 0
sh scripts/smoke-docker.sh                              # expect: exit 0 — ejecuta la imagen
status=0; grep -rnE '\.(skip|only)\(' tests || status=$?; test "$status" -eq 1
                                                        # expect: exit 0 — 1 = ninguna prueba saltada · 2 = error de grep, y falla
```

Toda expectativa es una propiedad, no un conteo. Toda línea sale 0 en un build correcto, y la
única cuyo éxito es un código distinto de 0 (`grep`) afirma el código exacto.

**Puntos manuales — lista de lanzamiento** (una vez, antes de abrir el piloto; copiada en
`docs/lanzamiento.md`):

- [ ] Cada paso tiene su tag: `git tag -l 'step-*'` lista `step-01-andamiaje` … `step-20-contenedor-ci` (20 tags). El repositorio lo crea §10 Bootstrap.
- [ ] Archivos que deben estar commiteados, **uno por invocación**:
      `git ls-files --error-unmatch .env.example` · `git ls-files --error-unmatch pnpm-lock.yaml` ·
      `git ls-files --error-unmatch .github/workflows/ci.yml` · `git ls-files --error-unmatch .claude/settings.json` ·
      `git ls-files --error-unmatch tests/unit/__snapshots__/pdf-ban_vinc.json` (y los otros 5) — cada uno sale 0.
      Y no ignorados, uno por invocación: `status=0; git check-ignore -q .env.example || status=$?; test "$status" -eq 1`
      (1 = no ignorado; 128 = error de uso, y eso falla) — igual para `pnpm-lock.yaml` y `.claude/settings.json`.
- [ ] El `.gitignore` estuvo antes del primer commit:
      `test "$(git log --diff-filter=A --format=%H -- .gitignore | tail -n 1)" = "$(git rev-list --max-parents=0 HEAD)"` sale 0.
- [ ] §10 Bootstrap se reejecutó una vez sobre el árbol ya construido, **salió 0** y `pnpm typecheck && pnpm lint && pnpm test` siguió en verde (el manifiesto conserva todas sus dependencias).
- [ ] Todas las filas de *Cross-artifact value reconciliation* y *Byte-exact artifact reconciliation* de §19.6 dicen `yes`, y los gates de lint/typecheck se corrieron desde la raíz **con el bundle presente**.
- [ ] **Revisión visual de los 6 PDF** generados con el fixture (y con un cliente real de prueba) contra los formatos oficiales: cada dato en su casilla, sin texto doble, secciones PEP/FATCA/CRS/moneda extranjera/origen de fondos/referencias/cónyuge en blanco. La firma un asesor senior de Corban.
- [ ] Ingreso real con Microsoft Entra: un staff activo entra; un usuario del tenant **no** registrado en `staff_members` es rechazado; un usuario de otro tenant no puede iniciar el flujo.
- [ ] Driver `azure` con la cuenta real: subir y descargar un PDF (SAS de 5 min caduca), contenedor sin acceso anónimo (`az storage container show-permission` o el portal).
- [ ] Correo real por ACS: OTP, invitación y un aviso de cambio de estado llegan a buzones de Gmail y Outlook sin caer en spam (dominio con SPF/DKIM).
- [ ] Revisión legal: texto del consentimiento `2026-11-v1`, política de retención y supresión, transferencia internacional (datos en East US 2).
- [ ] Application Insights (o Azure Monitor) recibe un error provocado a propósito con su `requestId`, y la alerta de disponibilidad de `/api/health/db` está activa.
- [ ] Migraciones aplicadas en producción con `pnpm db:migrate` como paso de release; `pnpm db:seed` con el `ADMIN_EMAIL` real; el coordinador cargó condiciones reales (las DEMO no existen en producción) y los festivos del año.
- [ ] Rollback practicado una vez: desplegar la imagen anterior con `az webapp config container set` y verificar `/api/health/db`.
- [ ] Pasada solo con teclado de los 4 flujos, una con lector de pantalla del flujo del cliente y una a 200 % de zoom en 320 px (§15).
- [ ] Ningún no-objetivo de §1 está construido; cada variable de §10 está en App Settings y ninguna en el repo; `AUTH_TEST_LOGIN=0` en producción.
- [ ] Los 4 flujos de §13 se recorren a mano contra la URL de producción con un cliente y un asesor de prueba.

**No se ignora ninguna advertencia.**

### 20.2 Risk register

| Risk | Likelihood | Impact | Early signal | Mitigation |
|---|---|---|---|---|
| Un dato cae en la casilla equivocada de un PDF oficial | M | H | La entidad devuelve un formato; diff inesperado en un snapshot golden | Golden por documento (valor de cada campo mapeado), prueba de "campos no mapeados vacíos", deduplicación probada, revisión visual de los 6 PDF en §20.1 — dueño: asesor senior |
| Fuga de datos personales/financieros (Ley 1581, contexto SARLAFT) | L | H | Un 200 en una prueba de aislamiento; PII en el log stream | Consentimiento versionado, `can()` + `filtroVisibilidad` con pruebas de aislamiento, Blob privado + SAS de 5 min, TLS, cifrado en reposo de Azure, auditoría solo inserción, límites de OTP, logger con redacción probada — dueño: responsable técnico |
| Excel de cartera sucio | H | M | Muchas filas rechazadas en la vista previa | Vista previa con errores por fila, perfiles de mapeo, upsert idempotente probado, .xlsx de rechazos — dueño: coordinador |
| pdf-lib sin mantenimiento desde 2022 | M | M | Un PDF nuevo de una entidad no carga o se corrompe | Versión exacta, aislado tras `src/server/pdf`, golden de los 6 formatos; si una entidad cambia a un PDF que pdf-lib no soporta, se evalúa un reemplazo solo para ese módulo — riesgo aceptado |
| Tabla de tasas mal configurada | M | H | `SIN_CONDICION`/`CONDICION_AMBIGUA` al enviar; tasas DEMO en producción | El motor bloquea el envío con mensaje claro, validación de solapes al guardar, insignia «DEMO», las DEMO solo existen con `--demo`, lista de lanzamiento — dueño: coordinador |
| Entra ID no se puede ejercitar en local | H | M | El primer ingreso real del staff falla en producción | `/api/test/login` solo fuera de producción con 404 probado en el build de producción; hook de lista blanca con prueba unitaria; ingreso real en §20.1 — dueño: responsable técnico |
| Claves del proveedor Microsoft de better-auth distintas a las supuestas | M | M | `pnpm typecheck` falla en el paso 5 | Marcadas UNVERIFIED; el typecheck del paso 5 las valida contra los tipos instalados |
| Alcance: piden renovación o envío automático durante el piloto | M | M | Pedidos de "solo un botón más" | Tabla de no-objetivos con disparadores; la API v1 y el portafolio son la base de la etapa 2 |

### 20.3 Decision log

| # | Decision | Rejected alternative | Why | Would reverse if |
|---|---|---|---|---|
| 1 | Track ts-node, Next.js 16 App Router con standalone | Rails/Laravel con admin incluido | Portal de cliente mobile-first + back-office + API para la app móvil en un solo lenguaje; el POC ya es JS | El equipo de mantenimiento de Corban fuera PHP/Ruby |
| 2 | PostgreSQL en Azure Flexible Server | SQL Server / Cosmos DB | Relacional con `jsonb`, triggers y unicidades de negocio; Drizzle de primera clase | Corban exigiera SQL Server por política corporativa |
| 3 | better-auth (Entra para staff + OTP para clientes) | Clerk, Entra External ID | Usuarios y sesiones en la base propia en Azure, sin costo por usuario, un solo dueño de sesión | Se necesitara MFA/SSO avanzado para clientes o el volumen de mantenimiento de auth creciera |
| 4 | Tablas de better-auth escritas a mano | CLI `auth generate` | No interactivo, sin dependencias extra; el paso 5 ejercita las tablas | better-auth 1.8 cambiara el esquema (migrar con su guía) |
| 5 | Azure App Service en contenedor | Vercel | Staff en M365, Entra nativo, datos y archivos en una suscripción | Se necesitaran previews por PR y edge global |
| 6 | Tailwind v4 + shadcn/ui (Radix) | CSS Modules / MUI | Tokens en un archivo, componentes accesibles copiados al repo | El cliente entregara un design system propio en otro stack |
| 7 | react-query solo en el área de cliente contra `/api/v1`; server actions en staff | Todo con server actions | La web del cliente ejercita a diario el contrato de la app móvil | Se descartara la app móvil |
| 8 | Congelar condiciones al aprobar; nueva versión al editar después | Recalcular en cada vista | La tasa ofrecida al cliente es la firmada; trazabilidad por versión | Las entidades garantizaran la tasa hasta la constitución |
| 9 | Auditoría inmutable por trigger | `REVOKE` a un rol de app | La app usa un solo rol dueño del esquema (el dueño no se puede revocar); el trigger se prueba | Se separaran roles de BD (migrador vs. app) |
| 10 | Límites de tasa en Postgres | Redis / memoria | Un solo servicio de estado; funciona con varias instancias | El volumen superara miles de OTP por hora |
| 11 | Motor de fechas propio en UTC | dayjs/date-fns | Cálculo pequeño, determinista y probado con fixtures | Aparecieran reglas de calendario financiero complejas (base 365/366 real) |
| 12 | Tailwind por `@tailwindcss/postcss` | `@tailwindcss/turbopack` | Funciona igual con Turbopack y con el respaldo `--webpack` | El loader de Turbopack fuera necesario por rendimiento |
| 13 | Copia del workspace con bucle `find` + `[ -e ] \|\|` | `rsync --ignore-existing`, `cp -Rn` | Portable, sale 0 al saltar en GNU y BSD, sin dependencias | — |
| 14 | `organizeImports` de Biome apagado | Ordenar imports automáticamente | Evita que los archivos emitidos fallen `lint` por un orden de imports; el formato sí se exige | El equipo quisiera orden automático (activar y correr `pnpm format` una vez) |
| 15 | `jsx: "react-jsx"` en tsconfig | `"preserve"` (pedido en la entrevista) | `tsc --noEmit` en un checkout limpio no depende de `next-env.d.ts` (ignorado por git); Next 16 acepta ambos y puede reescribirlo — por eso `tsconfig.json` está fuera de Biome | Next forzara `preserve` y el typecheck en limpio siguiera en verde |
| 16 | E2E contra `next dev` | E2E contra la build de producción | `/api/test/login` debe responder 404 en producción; ese 404 se prueba aparte con el smoke | Hubiera un IdP de pruebas para Entra |
| 17 | 20 pasos (fuera del rango 10–18) | Fusionar pasos | Número fijado por el usuario en Gate B; cada paso cabe en una sesión | — |

### 20.4 What to build next

1. **Renovación de CDT** — avisos de vencimiento por correo, nueva tasa desde la tabla, nueva
   solicitud prellenada desde `cdts` (disparador: 3 meses de vencimientos reales en el portafolio).
2. **App móvil nativa** sobre `/api/v1` con el plugin `bearer` de better-auth (disparador: 50 % de
   sesiones de cliente móviles y recurrentes).
3. **Envío automático a entidades** (correo estructurado o API) cuando una entidad entregue un
   canal técnico documentado.
4. **Firma electrónica** cuando las 4 entidades la acepten por escrito.
5. **Varios titulares por CDT** si más del 10 % de las solicitudes del piloto lo piden.

---

*Fin del blueprint. El orden de construcción es §9. Detente cuando §20.1 esté en verde.*

