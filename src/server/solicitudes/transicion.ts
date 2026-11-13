import { eq } from "drizzle-orm";
import type { Tx } from "@/server/auditoria/conAuditoria";
import { ErrorDominio } from "@/server/authz/errores";
import { solicitudEventos, solicitudes } from "@/server/db/schema";
import { type Accion, destinoDe, transicionValida } from "./estados.ts";

// Única vía para cambiar el estado de una solicitud (CLAUDE.md, reglas de server.md).
// Debe llamarse dentro de conAuditoria(): la fila de auditoría y la de evento van en la misma
// transacción que el cambio. Bloquea la fila con FOR UPDATE antes de validar.
export async function ejecutarTransicion(
  tx: Tx,
  entrada: {
    solicitudId: string;
    accion: Accion;
    actorUserId: string | null;
    nota?: string | null;
  },
): Promise<{ desde: string; hacia: string }> {
  const [actual] = await tx
    .select({ estado: solicitudes.estado })
    .from(solicitudes)
    .where(eq(solicitudes.id, entrada.solicitudId))
    .for("update");
  if (!actual) {
    throw new ErrorDominio("NO_ENCONTRADO", "No existe la solicitud");
  }
  if (!transicionValida(entrada.accion, actual.estado)) {
    throw new ErrorDominio(
      "TRANSICION_INVALIDA",
      `La solicitud no puede pasar por «${entrada.accion}» desde su estado actual`,
    );
  }
  const hacia = destinoDe(entrada.accion);
  await tx
    .update(solicitudes)
    .set({ estado: hacia })
    .where(eq(solicitudes.id, entrada.solicitudId));
  await tx.insert(solicitudEventos).values({
    solicitudId: entrada.solicitudId,
    tipo: "transicion",
    desde: actual.estado,
    hacia,
    actorUserId: entrada.actorUserId,
    nota: entrada.nota ?? null,
  });
  return { desde: actual.estado, hacia };
}
