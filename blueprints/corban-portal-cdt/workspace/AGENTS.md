# Corban FC — Portal de CDT — instrucciones para agentes

Portal web de solicitudes de CDT de Corban FC: clientes (OTP por correo) y staff (Microsoft Entra)
sobre Next.js 16, PostgreSQL y Drizzle. Toda la interfaz y la documentación van en español de Colombia.

## Comandos

| Tarea | Comando |
|---|---|
| Bootstrap | `sh scripts/bootstrap.sh` |
| Servicios | `pnpm services:up` · `pnpm services:down` |
| Dev | `pnpm dev` |
| Build + smoke | `pnpm build` · `sh scripts/smoke-standalone.sh /api/health '"status":"ok"'` |
| Typecheck / lint / formato | `pnpm typecheck` · `pnpm lint` · `pnpm format` |
| Pruebas | `pnpm db:test:prepare` y luego `pnpm test` (un archivo: `pnpm test <ruta>`) |
| E2E | `pnpm exec playwright install chromium` y luego `pnpm e2e` |
| Migraciones | `pnpm db:generate` · `pnpm db:migrate` · semilla `pnpm db:seed` |

Gate antes de terminar una tarea: `pnpm typecheck && pnpm lint && pnpm test`.
Orden del build: `blueprints/corban-portal-cdt/tasks.json` y `epics/`.

## No negociable

1. Ningún dato de un cliente es visible para otro cliente ni para un asesor no asignado: todo pasa por `can()` y `filtroVisibilidad()`, con prueba de aislamiento.
2. `audit_events` es solo inserción (trigger); toda transición y edición del staff deja auditoría con motivo.
3. La tasa, el vencimiento y el valor en letras los calcula el motor; nadie los escribe a mano. Las condiciones se congelan al aprobar.
4. Nunca se registran en logs documento, correo, celular, dirección, número de cuenta, OTP ni tokens.
5. `/api/test/login` responde 404 en producción, siempre.
6. Nunca commitees secretos, `.env` ni salida de build; nunca edites a mano `drizzle/` (salvo la migración `--custom`), `assets/formatos/` ni los snapshots golden.
7. Nunca marques una tarea como hecha con un gate en rojo, ni edites un comando de `verify`.

Arquitectura completa, fronteras, tokens de diseño y entorno: `CLAUDE.md` en este directorio.
Contratos de dominio (errores, permisos, estados, motores): `docs/referencia/contratos.md`.
