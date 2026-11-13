import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { getStorage } from "@/server/almacenamiento/storage";
import { ErrorDominio } from "@/server/authz/errores";
import type { Tx } from "@/server/auditoria/conAuditoria";
import { documentos, entidades } from "@/server/db/schema";
import { derivarDatosPdf, type Congelado } from "@/server/pdf/derivar";
import type { DocKey } from "@/server/pdf/mapeo";
import { generarPdf } from "@/server/pdf/motor";
import { nombreArchivoPdf } from "@/server/pdf/nombres";

// Genera un PDF por formato de la entidad para una versión de la solicitud. Lo usan la
// aprobación (versión 1) y la edición posterior (versión N+1). Si algo falla, borra lo subido.

export async function generarVersion(
  tx: Tx,
  entrada: {
    solicitudId: string;
    entidadId: string;
    datos: Record<string, string>;
    congelado: Congelado;
    version: number;
    actorUserId: string;
  },
): Promise<void> {
  const [entidad] = await tx
    .select({ docKeys: entidades.docKeys })
    .from(entidades)
    .where(eq(entidades.id, entrada.entidadId))
    .limit(1);
  const formatos = (entidad?.docKeys ?? []) as DocKey[];
  const subidas: string[] = [];

  try {
    for (const docKey of formatos) {
      const D = derivarDatosPdf(entrada.datos, entrada.congelado);
      const { bytes, reporte } = await generarPdf(docKey, D);
      if (reporte.notFound.length > 0) {
        throw new ErrorDominio(
          "ERROR_INTERNO",
          `Campos del formato ${docKey} no encontrados: ${reporte.notFound.join(", ")}`,
        );
      }
      const archivo = nombreArchivoPdf(docKey, entrada.datos.apellido1, entrada.version);
      const clave = `solicitudes/${entrada.solicitudId}/v${entrada.version}/${archivo}`;
      await getStorage().put(clave, bytes);
      subidas.push(clave);
      await tx.insert(documentos).values({
        solicitudId: entrada.solicitudId,
        version: entrada.version,
        tipo: "generado",
        docKey,
        storagePath: clave,
        nombreArchivo: archivo,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        bytes: bytes.length,
        estado: "vigente",
        subidoPor: entrada.actorUserId,
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
}

// Marca como desactualizados los documentos de versiones anteriores (generados y firmados).
export async function desactualizarAnteriores(
  tx: Tx,
  solicitudId: string,
  versionNueva: number,
): Promise<void> {
  await tx
    .update(documentos)
    .set({ estado: "desactualizado" })
    .where(
      and(
        eq(documentos.solicitudId, solicitudId),
        inArray(documentos.estado, ["vigente", "aceptado"]),
        // Las versiones anteriores a la nueva: todo lo que no es de la versión nueva.
        inArray(
          documentos.version,
          Array.from({ length: Math.max(versionNueva - 1, 0) }, (_, i) => i + 1),
        ),
      ),
    );
}
