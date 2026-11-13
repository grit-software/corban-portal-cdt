# Checklist — corban-portal-cdt

Fuente: `blueprints/corban-portal-cdt/tasks.json` (E1-T1 a E3-T6).
Regla: una tarea solo se marca como hecha cuando sus gates (`verify`) pasan.

## Prerrequisitos

- [x] Paso 1 — tag `step-01-andamiaje`
- [x] `pnpm install` (existe `node_modules/.pnpm`)
- [x] Postgres healthy (`docker compose up -d --wait postgres`) — verificado 2026-11-13

## Épica 01 — fundaciones

- [x] **E1-T1** Andamiaje y cadena de herramientas — verificado 2026-11-13
  - [x] `pnpm lint` (exit 0)
  - [x] `pnpm typecheck` (exit 0)
  - [x] `pnpm test` (17/17 archivos, 384 pruebas)
  - [x] `pnpm build` (produce `.next/standalone/server.js`)
  - [x] `sh scripts/smoke-standalone.sh /api/health '"status":"ok"'` (200)
- [x] **E1-T2** Servicios locales, entorno y cliente de BD (depende de E1-T1) — verificado 2026-11-13
- [x] **E1-T3** Esquema completo, auditoría inmutable y semilla (depende de E1-T2) — verificado 2026-11-13 (4 entidades)
- [x] **E1-T4** Autorización `can()`, auditoría transaccional y logger (depende de E1-T3) — verificado 2026-11-13
- [x] **E1-T5** Autenticación del staff (Entra, lista blanca, test-login) (depende de E1-T4) — verificado 2026-11-13
- [x] **E1-T6** Autenticación de clientes: registro, OTP e invitaciones (depende de E1-T5) — verificado 2026-11-13
- [x] **E1-T7** Condiciones de tasa, festivos y motor de cálculo (depende de E1-T6) — verificado 2026-11-13

## Épica 02 — producto cliente y asesor

- [x] **E2-T1** Sistema de diseño y shells (depende de E1-T6, E1-T7) — verificado 2026-11-13: contraste 16/16, responsive 28/28, typecheck y lint exit 0 (tras borrar `_oldnext/`), build exit 0 con `.next/standalone/server.js`, `display: "swap"` presente.
- [x] **E2-T2** API v1 del cliente: perfil, solicitudes y envío (depende de E1-T6, E1-T7) — verificado 2026-11-13
- [x] **E2-T3** Asistente del cliente, mobile-first (depende de E2-T1, E2-T2) — verificado 2026-11-13: asistente 4/4 (3 corridas seguidas tras el ajuste), responsive 28/28, typecheck, lint y build exit 0. Causa del fallo: la aserción de `abrirCdtCon` tenía 5 s y la creación de la solicitud en `next dev` tardaba más (botón `Abriendo…` deshabilitado en el snapshot). Ajuste en `tests/e2e/asistente.spec.ts`: margen de 30 s. Además, `playwright.config.ts` borra `.next` antes de arrancar `next dev`.
  - Historial previo (ya resuelto):
  - `asistente.spec.ts`: 4/4 en 3 de 4 corridas. Una corrida falló las 4 pruebas (la URL se quedó en `/nueva`, sin llegar a `/paso=cdt`). Hipótesis sin confirmar: clic antes de hidratar en el primer uso con caché fría de `next dev`.
  - `responsive.spec.ts` dentro de la cadena E2-T3: **20 fallos** cuando corre justo después de `asistente.spec.ts`; pasa cuando corre solo (E2-T1). Mismo síntoma que el fallo anterior de responsive (`Execution context was destroyed`).
  - Decisión del usuario (2026-11-13): aceptar el e2e intermitente. Sin marcar: `CLAUDE.md` (no negociable 7) prohíbe marcar una tarea con un gate en rojo, y el gate de E2-T3 falla en algunas corridas. Marcarla requiere una excepción explícita en `CLAUDE.md` o en el blueprint, que decide el usuario.
  - Intento de correr el e2e contra la build standalone: descartado. `/api/test/login` responde 404 con `NODE_ENV=production` (`src/app/api/test/login/route.ts:12`), así que el login de staff de las pruebas falla. Se revirtieron `playwright.config.ts` y el script temporal.
  - Con `.next` borrado (2026-11-13): asistente 1 fallo y responsive 20 fallos. Luego asistente 4 fallos. El servidor de `next dev` registró `The destination stream errored while writing data`. La hipótesis de la caché de `.next` queda descartada como causa única: los fallos crecen con las corridas sucesivas.
- [x] **E2-T4** Motor PDF y pruebas golden de los 6 formatos (depende de E1-T7, E2-T2) — verificado 2026-11-13 (mapeo 14/14, golden 24/24 en dos corridas)
- [x] **E2-T5** Máquina de estados, validación y PDFs versionados (depende de E2-T2, E2-T4) — verificado 2026-11-13 (estados 9/9)
- [x] **E2-T6** Carga del documento firmado y revisión (depende de E2-T3, E2-T5) — verificado 2026-11-13 (firmas 7/7, typecheck, lint, build exit 0)
- [x] **E2-T7** Espacio de trabajo del asesor (depende de E2-T6) — verificado 2026-11-13 (asesor 8/8, typecheck, lint, build exit 0)

## Épica 03 — entrega y operación

> Estado 2026-11-13: no existen los archivos de prueba de E3 (`tests/integration/portafolio|importacion|reportes|notificaciones|endurecimiento|ci`). La implementación no está hecha; las casillas siguen sin marcar.

- [x] **E3-T1** Envío a la entidad, constitución y portafolio (depende de E2-T7) — verificado 2026-11-13 en local, rama `e3-t1-portafolio` (commit `e5315ea` de la sesión cloud, traído por bundle). Gates: `docker compose up -d --wait postgres` y `pnpm db:test:prepare` OK; `pnpm test tests/integration/portafolio.test.ts` 8/8; `pnpm typecheck` OK; `pnpm lint` OK tras `pnpm format` (15 archivos con solo cambio de fin de línea CRLF→LF); `pnpm build` OK. Pendiente: commit del formato y push de la rama.
- [x] **E3-T2** Importación desde Excel (depende de E3-T1) — verificado 2026-11-13 en rama `e3-t2-importacion` (desde `e3-t1-portafolio`): importacion 6/6, suite completa 398/398, typecheck, lint y build exit 0. Criterios 1–4 y 6 cubiertos por la prueba. Criterio 5: `clientes.perfil` queda con las claves importadas; la precarga de la nueva solicitud no se probó aquí. Sin probar: lotes de más de 200 filas (un solo bloque) y la UI con navegador. Pendiente: commit y push de la rama.
- [x] **E3-T3** Reportes de gerencia y exportación (depende de E3-T1) — verificado 2026-11-13 en rama `e3-t3-reportes` (desde `e3-t2-importacion`): reportes 5/5, suite completa 403/403, typecheck, lint y build exit 0. Cubre inversión por entidad y asesor (= suma SQL), vencimientos 30/60/90 (solo vigentes, ascendente), resumen de solicitudes con promedio de días, exportación .xlsx releída y 403 PROHIBIDO para cliente y asesor. Sin probar: la pantalla `/gerencia` y la ruta `GET /api/staff/reportes/{reporte}/xlsx` por HTTP (la prueba llama al servicio). Pendiente: commit y push.
- [x] **E3-T4** Notificaciones, PWA y administración del staff (depende de E3-T3) — verificado 2026-11-13 en `e3-t3-reportes` (sin rama propia; encima de E3-T3 sin commit): notificaciones 7/7, suite completa 410/410, typecheck, lint, build y smoke de manifest e íconos (192 y 512) exit 0. Cubre correos por transición (asesor, coordinadores o cliente) con enlace, fallo de envío sin revertir y `notificado_at` nulo, manifest, administración del staff con auditoría y PROHIBIDO para coordinador. Sin probar: la pantalla `/admin/staff` en navegador y el envío real de correos (la prueba inyecta el envío). Pendiente: commit y push.
- [x] **E3-T5** Endurecimiento y E2E de los 4 flujos (depende de E3-T2, E3-T4) — verificado 2026-11-13 en `e3-t3-reportes` (sin commit): flujos 4/4, responsive 49/49 (incluye staff y `/mi-cuenta/portafolio`), endurecimiento 3/3 (6 cabeceras, 429 en la undécima, sin console.log), suite completa 413/413, typecheck, lint y build OK, smoke de `/api/test/login` → 404. Desviaciones: el flujo 2 aprueba con el coordinador (el asesor no está asignado a ese cliente); el flujo 3 registra la constitución con el formulario del asesor en el navegador; la edición usa `valor` como texto. Pendiente: commit y push.
- [ ] **E3-T6** Contenedor, CI y lista de lanzamiento (depende de E3-T5)
