import { and, asc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { Portafolio } from "@/lib/portafolio/tipos";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { hoyBogota } from "@/server/condiciones/opciones";
import { getDb } from "@/server/db/client";
import { cdts, entidades, solicitudes } from "@/server/db/schema";

// Portafolio (E3-T1): CDT vigentes = estado `vigente` y fecha de vencimiento hoy o después.
// Lo que el actor no puede ver responde NO_ENCONTRADO (server.md), nunca PROHIBIDO.

export const PROXIMOS_VENCIMIENTOS = 3;

// Filtro de alcance dentro del WHERE, después de can(). Cliente: solo lo suyo. Asesor: los
// clientes con solicitudes asignadas. Coordinador, gerencia y admin: todo (o un cliente concreto).
async function alcanceDe(actor: Actor, clienteId?: string): Promise<SQL> {
  if (actor.tipo === "cliente") {
    if (clienteId && clienteId !== actor.clienteId) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese portafolio");
    }
    if (!can(actor, "portafolio.ver", { clienteId: actor.clienteId })) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese portafolio");
    }
    return eq(cdts.clienteId, actor.clienteId ?? "");
  }

  if (actor.rol === "asesor") {
    const asignados = and(
      eq(solicitudes.asesorId, actor.staffId),
      sql`${solicitudes.deletedAt} is null`,
    );
    if (clienteId) {
      const [vinculo] = await getDb()
        .select({ id: solicitudes.id })
        .from(solicitudes)
        .where(and(asignados, eq(solicitudes.clienteId, clienteId)))
        .limit(1);
      if (!vinculo || !can(actor, "portafolio.ver", { asesorId: actor.staffId })) {
        throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese portafolio");
      }
      return eq(cdts.clienteId, clienteId);
    }
    if (!can(actor, "portafolio.ver", { asesorId: actor.staffId })) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese portafolio");
    }
    return inArray(
      cdts.clienteId,
      getDb().select({ id: solicitudes.clienteId }).from(solicitudes).where(asignados),
    );
  }

  if (!can(actor, "portafolio.ver")) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese portafolio");
  }
  return clienteId ? eq(cdts.clienteId, clienteId) : sql`true`;
}

// `clienteId` solo lo usa el staff que puede ver a ese cliente; el cliente siempre ve el suyo.
export async function portafolioDe(actor: Actor, clienteId?: string): Promise<Portafolio> {
  const alcance = await alcanceDe(actor, clienteId);
  const hoy = hoyBogota();

  const filas = await getDb()
    .select({
      id: cdts.id,
      numeroCdt: cdts.numeroCdt,
      entidad: entidades.nombre,
      valor: cdts.valor,
      tasaEa: cdts.tasaEa,
      fechaApertura: cdts.fechaApertura,
      fechaVenc: cdts.fechaVenc,
      periodicidad: cdts.periodicidad,
      estado: cdts.estado,
    })
    .from(cdts)
    .innerJoin(entidades, eq(entidades.id, cdts.entidadId))
    .where(and(alcance, eq(cdts.estado, "vigente"), gte(cdts.fechaVenc, hoy)))
    .orderBy(asc(cdts.fechaVenc), asc(cdts.numeroCdt));

  const totalInvertido = filas.reduce((suma, fila) => suma + fila.valor, 0);
  return {
    vigentes: filas,
    totalInvertido,
    proximosVencimientos: filas.slice(0, PROXIMOS_VENCIMIENTOS),
  };
}
