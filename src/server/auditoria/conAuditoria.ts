import type { Db } from "@/server/db/client";
import { getDb } from "@/server/db/client";
import { auditEvents } from "@/server/db/schema";

// Transacción de dominio: ejecuta la mutación y su fila de auditoría en la misma transacción.
// Si la mutación lanza, se revierte todo (CLAUDE.md, regla 6).
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type EventoAuditoria = {
  accion: string;
  actorId: string | null;
  actorIp?: string | null;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
};

export async function conAuditoria<T>(
  evento: EventoAuditoria,
  trabajo: (tx: Tx) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    const resultado = await trabajo(tx);
    await tx.insert(auditEvents).values({
      accion: evento.accion,
      actorId: evento.actorId,
      actorIp: evento.actorIp ?? null,
      targetType: evento.targetType,
      targetId: evento.targetId,
      metadata: evento.metadata ?? {},
    });
    return resultado;
  });
}
