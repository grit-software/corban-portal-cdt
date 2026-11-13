import { createHash } from "node:crypto";
import { getStorage } from "@/server/almacenamiento/storage";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { consumirLimite } from "@/server/auth/limite";
import { documentos } from "@/server/db/schema";
import { exigirCliente } from "@/server/solicitudes/acceso";
import { ejecutarTransicion } from "@/server/solicitudes/transiciones";
import { and, eq } from "drizzle-orm";
import { unirEnPdf } from "./unir.ts";
import { tipoPorBytes } from "./tipo.ts";

// Carga y revisión de la firma (contratos.md §3). La validación del tipo va antes de escribir.

export const MAX_ARCHIVOS = 10;
export const MAX_BYTES_TOTAL = 15 * 1024 * 1024;

export type ArchivoCargado = { nombre: string; bytes: Uint8Array };

// El cliente sube sus imágenes o PDF firmados: quedan como un único PDF de la versión actual.
export async function cargarFirmados(
  actor: Actor,
  solicitudId: string,
  archivos: ArchivoCargado[],
): Promise<{ estado: string }> {
  const cliente = exigirCliente(actor);
  const limite = await consumirLimite(`firmados:${cliente.userId}`, 20, 3600);
  if (!limite.permitido) {
    throw new ErrorDominio(
      "LIMITE_EXCEDIDO",
      "Demasiadas cargas seguidas. Espera e intenta de nuevo.",
    );
  }

  // Todos los tipos se revisan antes de guardar nada: un archivo malo rechaza la carga completa.
  const tipados = archivos.map((archivo) => {
    const tipo = tipoPorBytes(archivo.bytes);
    if (!tipo) {
      throw new ErrorDominio("TIPO_NO_PERMITIDO", "Solo se aceptan archivos PDF, JPEG o PNG");
    }
    return { bytes: archivo.bytes, tipo };
  });
  const pdf = await unirEnPdf(tipados);
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  const subidas: string[] = [];

  try {
    await ejecutarTransicion(cliente, solicitudId, "cargar_firma", {}, async (tx, fila) => {
      const archivo = `firmado-${Date.now()}.pdf`;
      const clave = `solicitudes/${solicitudId}/v${fila.versionActual}/${archivo}`;
      await getStorage().put(clave, pdf);
      subidas.push(clave);
      await tx.insert(documentos).values({
        solicitudId,
        version: fila.versionActual,
        tipo: "firmado",
        docKey: null,
        storagePath: clave,
        nombreArchivo: archivo,
        sha256,
        bytes: pdf.length,
        estado: "vigente",
        subidoPor: cliente.userId,
      });
    });
  } catch (error) {
    for (const clave of subidas) {
      await getStorage()
        .delete(clave)
        .catch(() => undefined);
    }
    throw error;
  }
  return { estado: "firma_en_revision" };
}

// Aceptar o rechazar la firma. Rechazar exige motivo; el firmado queda marcado según la decisión.
export async function revisarFirma(
  actor: Actor,
  solicitudId: string,
  decision: "aceptar" | "rechazar",
  motivo?: string,
): Promise<{ estado: string }> {
  if (decision === "aceptar") {
    await ejecutarTransicion(actor, solicitudId, "aceptar_firma", {}, async (tx, fila) => {
      await tx
        .update(documentos)
        .set({ estado: "aceptado" })
        .where(
          and(
            eq(documentos.solicitudId, solicitudId),
            eq(documentos.tipo, "firmado"),
            eq(documentos.version, fila.versionActual),
            eq(documentos.estado, "vigente"),
          ),
        );
    });
    return { estado: "lista_para_enviar" };
  }

  const texto = motivo?.trim() ?? "";
  if (texto.length === 0) {
    throw new ErrorDominio("MOTIVO_REQUERIDO", "Indica por qué se rechaza la firma");
  }
  await ejecutarTransicion(
    actor,
    solicitudId,
    "rechazar_firma",
    { nota: texto },
    async (tx, fila) => {
      await tx
        .update(documentos)
        .set({ estado: "rechazado", motivoRechazo: texto })
        .where(
          and(
            eq(documentos.solicitudId, solicitudId),
            eq(documentos.tipo, "firmado"),
            eq(documentos.version, fila.versionActual),
            eq(documentos.estado, "vigente"),
          ),
        );
    },
  );
  return { estado: "pendiente_firma" };
}
