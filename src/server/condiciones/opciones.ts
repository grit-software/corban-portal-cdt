import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { getDb } from "@/server/db/client";
import { condicionesTasa, entidades } from "@/server/db/schema";

// "Hoy" para las vigencias: día calendario en America/Bogota (regla de CLAUDE.md para fechas).
export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type OpcionCondicion = { plazoDias: number; periodicidad: string; tasaEa: string };

// Plazos y periodicidades con condición vigente HOY para ese monto. Solo tasaEa, plazoDias y
// periodicidad: nunca la fila cruda (api-v1.md).
export async function opcionesPara(
  actor: Actor,
  entidadId: string,
  valor: number,
  hoy: string = hoyBogota(),
): Promise<OpcionCondicion[]> {
  if (!can(actor, "condiciones.ver")) {
    throw new ErrorDominio("PROHIBIDO", "No puedes consultar las condiciones");
  }
  const db = getDb();
  const [entidad] = await db
    .select({ montoMinimo: entidades.montoMinimo })
    .from(entidades)
    .where(and(eq(entidades.id, entidadId), eq(entidades.activa, true)))
    .limit(1);
  if (!entidad) {
    throw new ErrorDominio("NO_ENCONTRADO", "La entidad no existe");
  }
  if (valor < entidad.montoMinimo) {
    return [];
  }

  const filas = await db
    .select({
      plazoDias: condicionesTasa.plazoDias,
      periodicidad: condicionesTasa.periodicidad,
      tasaEa: condicionesTasa.tasaEa,
    })
    .from(condicionesTasa)
    .where(
      and(
        eq(condicionesTasa.entidadId, entidadId),
        lte(condicionesTasa.vigenteDesde, hoy),
        or(isNull(condicionesTasa.vigenteHasta), gte(condicionesTasa.vigenteHasta, hoy)),
        lte(condicionesTasa.montoMin, valor),
        or(isNull(condicionesTasa.montoMax), gte(condicionesTasa.montoMax, valor)),
        sql`true`,
      ),
    )
    .orderBy(asc(condicionesTasa.plazoDias), asc(condicionesTasa.periodicidad));
  return filas;
}
