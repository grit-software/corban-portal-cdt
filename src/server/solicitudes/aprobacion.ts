import { eq } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { calcularParaSolicitud } from "@/server/condiciones/calcular";
import { hoyBogota } from "@/server/condiciones/opciones";
import { solicitudVersiones, solicitudes } from "@/server/db/schema";
import { generarVersion } from "./generados.ts";
import { ejecutarTransicion } from "./transiciones.ts";

// Aprobar (contratos.md §3): congela condiciones, crea la versión 1 y genera un PDF por formato
// de la entidad. Todo ocurre dentro de la transición: si un PDF falla, se revierte la base y se
// borran los archivos ya subidos.

export async function aprobar(actor: Actor, solicitudId: string) {
  if (actor.tipo !== "staff") {
    throw new ErrorDominio("PROHIBIDO", "Solo el equipo puede aprobar una solicitud");
  }
  return ejecutarTransicion(actor, solicitudId, "aprobar", {}, async (tx, fila) => {
    if (!fila.fechaApertura || fila.fechaApertura < hoyBogota()) {
      throw new ErrorDominio(
        "FECHA_APERTURA_PASADA",
        "La fecha de apertura ya pasó: pide al cliente que la actualice",
      );
    }
    if (fila.valor === null || fila.plazoDias === null || fila.periodicidad === null) {
      throw new ErrorDominio("VALIDACION", "La solicitud no tiene valor, plazo o periodicidad");
    }

    // La condición se recalcula con la tabla vigente hoy y se congela en la solicitud.
    const calculo = await calcularParaSolicitud(actor, {
      entidadId: fila.entidadId,
      valor: fila.valor,
      plazoDias: fila.plazoDias,
      periodicidad: fila.periodicidad,
      fechaApertura: fila.fechaApertura,
    });
    const congelado = {
      valor: fila.valor,
      plazoDias: fila.plazoDias,
      periodicidad: fila.periodicidad,
      tasaEa: calculo.tasaEa,
      fechaApertura: fila.fechaApertura,
      fechaVenc: calculo.fechaVenc,
    };

    await tx
      .update(solicitudes)
      .set({
        tasaEa: calculo.tasaEa,
        fechaVenc: calculo.fechaVenc,
        condicionId: calculo.condicionId,
        aprobadaAt: new Date(),
        aprobadaPor: actor.staffId,
        versionActual: 1,
      })
      .where(eq(solicitudes.id, solicitudId));

    await tx.insert(solicitudVersiones).values({
      solicitudId,
      numero: 1,
      datos: fila.datos,
      condiciones: {
        ...congelado,
        condicionId: calculo.condicionId,
        plazoMeses: calculo.plazoMeses,
      },
      creadoPor: actor.userId,
    });

    await generarVersion(tx, {
      solicitudId,
      entidadId: fila.entidadId,
      datos: fila.datos,
      congelado,
      version: 1,
      actorUserId: actor.userId,
    });
  });
}
