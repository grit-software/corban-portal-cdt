import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getStorage } from "@/server/almacenamiento/storage";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { getDb } from "@/server/db/client";
import { documentos, solicitudes } from "@/server/db/schema";
import { visiblesPara } from "./visibilidad.ts";

// Documentos de una solicitud. Lo que el actor no puede ver de la solicitud responde
// NO_ENCONTRADO: el documento se busca siempre dentro de una solicitud visible.

async function solicitudVisible(actor: Actor, solicitudId: string): Promise<void> {
  const [fila] = await getDb()
    .select({ id: solicitudes.id })
    .from(solicitudes)
    .where(and(eq(solicitudes.id, solicitudId), visiblesPara(actor)))
    .limit(1);
  if (!fila) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
  }
}

export async function listarDocumentos(actor: Actor, solicitudId: string) {
  await solicitudVisible(actor, solicitudId);
  const filas = await getDb()
    .select({
      id: documentos.id,
      tipo: documentos.tipo,
      docKey: documentos.docKey,
      version: documentos.version,
      estado: documentos.estado,
      nombreArchivo: documentos.nombreArchivo,
    })
    .from(documentos)
    .where(eq(documentos.solicitudId, solicitudId));
  return filas;
}

// Bytes verificados contra el sha256 guardado, o una URL firmada si el almacenamiento la da.
export async function descargarDocumento(
  actor: Actor,
  solicitudId: string,
  docId: string,
): Promise<{ tipo: "bytes"; bytes: Uint8Array; nombre: string } | { tipo: "url"; url: string }> {
  await solicitudVisible(actor, solicitudId);
  const [doc] = await getDb()
    .select()
    .from(documentos)
    .where(and(eq(documentos.id, docId), eq(documentos.solicitudId, solicitudId)))
    .limit(1);
  if (!doc) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese documento");
  }

  const almacen = getStorage();
  const url = await almacen.signedUrl(doc.storagePath);
  if (url) {
    return { tipo: "url", url };
  }
  const bytes = await almacen.get(doc.storagePath);
  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== doc.sha256) {
    throw new ErrorDominio("ERROR_INTERNO", "El documento no coincide con su huella guardada");
  }
  return { tipo: "bytes", bytes, nombre: doc.nombreArchivo };
}
