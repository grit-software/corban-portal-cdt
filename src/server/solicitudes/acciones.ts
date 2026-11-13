import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { solicitudes } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { ejecutarTransicion } from "./transiciones.ts";

// Acciones del asesor y del coordinador que piden motivo, observación o fecha (contratos.md §3).
// La validación del dato va antes de la transición: si falta, no se escribe nada.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

function exigirTexto(valor: string | undefined, mensaje: string): string {
  const texto = valor?.trim() ?? "";
  if (texto.length === 0) {
    throw new ErrorDominio("MOTIVO_REQUERIDO", mensaje);
  }
  return texto;
}

export async function devolver(actor: Actor, solicitudId: string, observacion: string | undefined) {
  const texto = exigirTexto(observacion, "Indica qué debe corregir el cliente");
  return ejecutarTransicion(actor, solicitudId, "devolver", { nota: texto }, async (tx) => {
    await tx.update(solicitudes).set({ observacion: texto }).where(eq(solicitudes.id, solicitudId));
  });
}

export async function cancelar(actor: Actor, solicitudId: string, motivo: string | undefined) {
  const texto = exigirTexto(motivo, "Indica el motivo de la cancelación");
  return ejecutarTransicion(actor, solicitudId, "cancelar", { nota: texto }, async (tx) => {
    await tx
      .update(solicitudes)
      .set({ motivoCancelacion: texto })
      .where(eq(solicitudes.id, solicitudId));
  });
}

export async function enviarEntidad(
  actor: Actor,
  solicitudId: string,
  datos: { fechaEnvio?: string; radicado?: string },
) {
  if (!datos.fechaEnvio || !FECHA.test(datos.fechaEnvio)) {
    throw new ErrorDominio("VALIDACION", "Indica la fecha de envío", {
      fechaEnvio: "Usa la fecha como aaaa-mm-dd",
    });
  }
  const radicado = datos.radicado?.trim() || null;
  return ejecutarTransicion(actor, solicitudId, "enviar_entidad", {}, async (tx) => {
    await tx
      .update(solicitudes)
      .set({ fechaEnvio: datos.fechaEnvio ?? null, radicado })
      .where(eq(solicitudes.id, solicitudId));
  });
}
