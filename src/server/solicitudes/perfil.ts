import { eq, sql } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { clientes } from "@/server/db/schema";
import { exigirCliente } from "./acceso.ts";

// Perfil del cliente: los datos que se reutilizan entre solicitudes (clientes.perfil).

export async function obtenerPerfil(actor: Actor): Promise<Record<string, string>> {
  const cliente = exigirCliente(actor);
  const [fila] = await getDb()
    .select({ perfil: clientes.perfil })
    .from(clientes)
    .where(eq(clientes.id, cliente.clienteId))
    .limit(1);
  if (!fila) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos tu registro");
  }
  return fila.perfil;
}

// Fusiona las claves recibidas en el perfil. El cuerpo ya fue validado por esquemaPerfil.
export async function actualizarPerfil(
  actor: Actor,
  datos: Record<string, string>,
): Promise<Record<string, string>> {
  const cliente = exigirCliente(actor);
  await conAuditoria(
    {
      accion: "perfil.actualizar",
      actorId: actor.userId,
      targetType: "cliente",
      targetId: cliente.clienteId,
      metadata: { claves: Object.keys(datos) },
    },
    async (tx) => {
      await tx
        .update(clientes)
        .set({
          perfil: sql`coalesce(${clientes.perfil}, '{}'::jsonb) || ${JSON.stringify(datos)}::jsonb`,
        })
        .where(eq(clientes.id, cliente.clienteId));
    },
  );
  return obtenerPerfil(actor);
}
