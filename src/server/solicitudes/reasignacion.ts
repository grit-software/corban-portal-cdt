import { and, eq, notInArray } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { clientes, solicitudes, staffMembers } from "@/server/db/schema";

// Reasignación de un cliente a otro asesor (contratos.md §2: solo el coordinador). Las solicitudes
// no finales pasan con él; las finales se quedan como están.

export async function reasignarCliente(actor: Actor, clienteId: string, nuevoAsesorId: string) {
  if (!can(actor, "cliente.reasignar")) {
    throw new ErrorDominio("PROHIBIDO", "Solo el coordinador puede reasignar clientes");
  }
  const db = getDb();
  const [asesor] = await db
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(and(eq(staffMembers.id, nuevoAsesorId), eq(staffMembers.activo, true)))
    .limit(1);
  if (!asesor) {
    throw new ErrorDominio("NO_ENCONTRADO", "El asesor no existe o está inactivo");
  }

  const evento = {
    accion: "cliente.reasignar",
    actorId: actor.userId,
    targetType: "cliente",
    targetId: clienteId,
    metadata: {} as Record<string, unknown>,
  };
  await conAuditoria(evento, async (tx) => {
    const [cliente] = await tx
      .select({ asesorId: clientes.asesorId })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .for("update");
    if (!cliente) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese cliente");
    }
    await tx.update(clientes).set({ asesorId: nuevoAsesorId }).where(eq(clientes.id, clienteId));
    await tx
      .update(solicitudes)
      .set({ asesorId: nuevoAsesorId })
      .where(
        and(
          eq(solicitudes.clienteId, clienteId),
          notInArray(solicitudes.estado, ["cdt_constituido", "cancelada"]),
        ),
      );
    evento.metadata = {
      cambios: [{ campo: "asesor_id", antes: cliente.asesorId, despues: nuevoAsesorId }],
    };
  });
}
