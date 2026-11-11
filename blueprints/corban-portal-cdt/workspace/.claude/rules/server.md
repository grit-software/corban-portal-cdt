---
description: Servicios de dominio, autorización, auditoría y transacciones
paths:
  - "src/server/**"
---

# Servicios de `src/server/**`

- Cada función pública de servicio recibe `actor: Actor` como primer argumento y llama `can()`
  **antes** de leer o escribir. Sin actor no hay servicio (los scripts usan funciones `*Sistema`
  explícitas y auditan con `actorId: null`).
- Lectura: aplica `filtroVisibilidad(actor)` dentro del `WHERE`; un recurso que el actor no puede
  ver lanza `ErrorDominio("NO_ENCONTRADO")`, nunca `PROHIBIDO`. `PROHIBIDO` solo si lo ve pero no
  puede la acción.
- Escritura de dominio: siempre dentro de `conAuditoria(evento, async (tx) => …)`; usa `tx`, no
  `getDb()`, dentro del callback. `accion` en minúsculas con punto: `solicitud.aprobar`,
  `condicion.crear`, `staff.desactivar`.
- Transiciones de solicitud solo con `ejecutarTransicion()`: carga con `select … for update`,
  valida la tabla de `estados.ts`, escribe `solicitud_eventos` + `audit_events` en la misma
  transacción. Nunca un `update solicitudes set estado = …` suelto.
- Ediciones del staff: `motivo` obligatorio (`MOTIVO_REQUERIDO`) y diffs
  `{ campo, antes, despues }` en `metadata.cambios`.
- Efectos externos (correo, borrado de archivos huérfanos) **después** del commit; un fallo ahí se
  registra y no revierte la transacción.
- Almacenamiento solo con `getStorage()`; rutas `solicitudes/<id>/v<version>/<archivo>`.
- Logs con `log.*` de `src/lib/logger.ts`; nunca `console.log`; nunca PII en el mensaje.
- Fechas de negocio como `yyyy-mm-dd`; "hoy" se calcula en America/Bogota; aritmética en UTC.
- Errores de Postgres: drizzle 0.45 los envuelve; el código SQLSTATE está en `(error.cause ?? error).code`
  (`23505` unicidad → `CONFLICTO` o el código de negocio que corresponda).
