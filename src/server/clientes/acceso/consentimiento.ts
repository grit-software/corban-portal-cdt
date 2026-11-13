import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { VERSION_CONSENTIMIENTO } from "@/server/auth/actor";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { consentimientos } from "@/server/db/schema";

// Consentimiento Ley 1581 (contratos.md §8). Una fila por usuario y versión.
export async function registrarConsentimiento(
  actor: Actor,
  contexto: { ip: string; userAgent: string },
): Promise<void> {
  if (actor.tipo !== "cliente") {
    throw new ErrorDominio("PROHIBIDO", "Solo un cliente puede registrar su consentimiento");
  }
  const db = getDb();
  const [previo] = await db
    .select({ id: consentimientos.id })
    .from(consentimientos)
    .where(
      and(
        eq(consentimientos.userId, actor.userId),
        eq(consentimientos.version, VERSION_CONSENTIMIENTO),
      ),
    )
    .limit(1);
  if (previo) {
    return; // ya aceptado en esta versión: no se duplica ni se audita de nuevo
  }

  const id = randomUUID();
  await conAuditoria(
    {
      accion: "consentimiento.aceptar",
      actorId: actor.userId,
      actorIp: contexto.ip,
      targetType: "consentimiento",
      targetId: id,
      metadata: { version: VERSION_CONSENTIMIENTO },
    },
    async (tx) => {
      await tx
        .insert(consentimientos)
        .values({
          id,
          userId: actor.userId,
          clienteId: actor.clienteId,
          version: VERSION_CONSENTIMIENTO,
          ip: contexto.ip,
          userAgent: contexto.userAgent,
        })
        .onConflictDoNothing();
    },
  );
}
