import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { calcularParaSolicitud } from "@/server/condiciones/calcular";
import { hoyBogota } from "@/server/condiciones/opciones";
import { getStorage } from "@/server/almacenamiento/storage";
import { documentos, entidades, solicitudVersiones, solicitudes } from "@/server/db/schema";
import { derivarDatosPdf } from "@/server/pdf/derivar";
import { generarPdf } from "@/server/pdf/motor";
import { nombreArchivoPdf } from "@/server/pdf/nombres";
import type { DocKey } from "@/server/pdf/mapeo";
import { ejecutarTransicion } from "./transiciones.ts";

// Aprobar (contratos.md §3): congela condiciones, crea la versión 1 y genera un PDF por formato
// de la entidad. Todo ocurre dentro de la transición: si un PDF falla, se revierte la base y se
// borran los archivos ya subidos.

export async function aprobar(actor: Actor, solicitudId: string) {
  if (actor.tipo !== "staff") {
    throw new ErrorDominio("PROHIBIDO", "Solo el equipo puede aprobar una solicitud");
  }
  const subidas: string[] = [];
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

    const [entidad] = await tx
      .select({ docKeys: entidades.docKeys })
      .from(entidades)
      .where(eq(entidades.id, fila.entidadId))
      .limit(1);
    const formatos = (entidad?.docKeys ?? []) as DocKey[];

    try {
      for (const docKey of formatos) {
        const D = derivarDatosPdf(fila.datos, congelado);
        const { bytes, reporte } = await generarPdf(docKey, D);
        if (reporte.notFound.length > 0) {
          throw new Error(
            `Campos del formato ${docKey} no encontrados: ${reporte.notFound.join(", ")}`,
          );
        }
        const archivo = nombreArchivoPdf(docKey, fila.datos.apellido1, 1);
        const clave = `solicitudes/${solicitudId}/v1/${archivo}`;
        await getStorage().put(clave, bytes);
        subidas.push(clave);
        await tx.insert(documentos).values({
          solicitudId,
          version: 1,
          tipo: "generado",
          docKey,
          storagePath: clave,
          nombreArchivo: archivo,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          bytes: bytes.length,
          estado: "vigente",
          subidoPor: actor.userId,
        });
      }
    } catch (error) {
      for (const clave of subidas) {
        await getStorage()
          .delete(clave)
          .catch(() => undefined);
      }
      throw error;
    }
  });
}
