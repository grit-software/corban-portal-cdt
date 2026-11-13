import { type SQL, and, eq, isNull, sql } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { solicitudes } from "@/server/db/schema";

// Filtro de visibilidad dentro del WHERE (CLAUDE.md, regla 1): lo que el actor no puede ver no
// llega al servicio. Es el mismo criterio que la matriz de can() para solicitud.ver.
export function filtroVisibilidad(actor: Actor): SQL {
  if (actor.tipo === "cliente") {
    if (!actor.clienteId) {
      return sql`false`;
    }
    return eq(solicitudes.clienteId, actor.clienteId);
  }
  if (actor.rol === "asesor") {
    return eq(solicitudes.asesorId, actor.staffId);
  }
  return sql`true`;
}

// Solicitudes no borradas lógicamente y visibles para el actor.
export function visiblesPara(actor: Actor): SQL | undefined {
  return and(isNull(solicitudes.deletedAt), filtroVisibilidad(actor));
}
