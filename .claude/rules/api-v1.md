---
description: Contrato de la API v1 del cliente (también la futura app móvil)
paths:
  - "src/app/api/v1/**"
  - "src/app/api/staff/**"
---

# API `/api/v1/**` (y `/api/staff/**`)

- `/api/v1` es un contrato público versionado: no renombres campos ni cambies tipos de una
  respuesta existente. Un cambio incompatible es `/api/v2`. Agregar campos opcionales sí se permite.
- Sobre único: éxito `{ data }` (listas `{ data, meta: { pagina, porPagina, total } }`); error
  `{ error: { code, message, fields? } }` vía `respuestaError()`. Códigos y HTTP en
  `docs/referencia/contratos.md` §1 — no inventes códigos nuevos sin añadirlos allí y en §5 del blueprint.
- Orden en cada handler: `getActor(request.headers)` (401 si nulo) → `exigirMismoOrigen(request)`
  en POST/PATCH/DELETE → `leerCuerpo(request, esquema)` (422 `VALIDACION`) → servicio → `ok()`.
- Nunca lógica de negocio ni consultas en el handler: solo traducir HTTP ↔ servicio.
- Lee cabeceras y cuerpo de `request`, nunca de `next/headers` (los handlers se prueban
  llamándolos directamente desde Vitest).
- `context.params` es una `Promise` en Next 16: `const { id } = await context.params`.
- `export const dynamic = "force-dynamic"` en todo handler que lee sesión o base.
- Descargas: nunca expongas `storage_path`; el driver `fs` devuelve bytes con
  `content-disposition: attachment`, el `azure` responde 302 a una SAS de 5 minutos.
- Cargas multipart: suma `File.size` y valida límites **antes** de leer bytes; valida el tipo por
  bytes iniciales, no por MIME.
- Respuestas de cliente nunca incluyen datos de otros clientes, ids de staff internos ni la
  condición de tasa cruda (solo `tasaEa`, `plazoDias`, `periodicidad`).
