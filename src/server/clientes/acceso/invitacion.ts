import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { enviar } from "@/server/correo/enviar";
import { plantillas } from "@/server/correo/plantillas";
import { getDb } from "@/server/db/client";
import { clientes, invitaciones, staffMembers } from "@/server/db/schema";
import type { DatosRegistro } from "./esquemas.ts";

// Invitaciones: el token (32 bytes, base64url) viaja solo en el correo; en la base se guarda su
// SHA-256. Vence a los 7 días y es de un solo uso.
const DIAS_VIGENCIA = 7;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function codigoDePg(error: unknown): string | undefined {
  const envuelto = error as { cause?: { code?: string }; code?: string };
  return (envuelto.cause ?? envuelto).code;
}

export async function crearInvitacion(
  actor: Actor,
  datos: Pick<DatosRegistro, "tipoDoc" | "numDoc" | "nombre" | "email">,
): Promise<{ clienteId: string }> {
  if (actor.tipo !== "staff" || !can(actor, "cliente.invitar")) {
    throw new ErrorDominio("PROHIBIDO", "No puedes invitar clientes");
  }
  const db = getDb();
  const correo = datos.email.trim().toLowerCase();

  const [existente] = await db
    .select({ id: clientes.id, email: clientes.email })
    .from(clientes)
    .where(and(eq(clientes.tipoDoc, datos.tipoDoc), eq(clientes.numDoc, datos.numDoc)))
    .limit(1);
  if (existente && existente.email.toLowerCase() !== correo) {
    throw new ErrorDominio(
      "DOCUMENTO_REGISTRADO",
      "Ese documento ya está registrado con otro correo",
    );
  }

  const clienteId = existente?.id ?? randomUUID();
  const token = randomBytes(32).toString("base64url");
  const invitacionId = randomUUID();
  const expiraEn = new Date(Date.now() + DIAS_VIGENCIA * 24 * 60 * 60 * 1000);

  try {
    await conAuditoria(
      {
        accion: "invitacion.crear",
        actorId: actor.userId,
        targetType: "cliente",
        targetId: clienteId,
        metadata: { invitacionId },
      },
      async (tx) => {
        if (!existente) {
          await tx.insert(clientes).values({
            id: clienteId,
            tipoDoc: datos.tipoDoc,
            numDoc: datos.numDoc,
            email: correo,
            nombre: datos.nombre,
            asesorId: actor.staffId,
            origen: "invitacion",
          });
        }
        await tx.insert(invitaciones).values({
          id: invitacionId,
          clienteId,
          asesorId: actor.staffId,
          email: correo,
          tokenHash: hashToken(token),
          expiresAt: expiraEn,
        });
      },
    );
  } catch (error) {
    if (codigoDePg(error) === "23505") {
      throw new ErrorDominio("CONFLICTO", "Ya hay una invitación para ese cliente");
    }
    throw error;
  }

  // Correo después del commit: si falla se registra, no revierte la invitación.
  try {
    const [asesor] = await db
      .select({ nombre: staffMembers.nombre })
      .from(staffMembers)
      .where(eq(staffMembers.id, actor.staffId))
      .limit(1);
    const enlace = `${getEnv().BETTER_AUTH_URL}/invitacion/${token}`;
    await enviar({
      para: correo,
      ...plantillas.invitacion({ nombreAsesor: asesor?.nombre ?? "Tu asesor", enlace }),
    });
  } catch (error) {
    log.error("no se pudo enviar la invitación", {
      tipo: error instanceof Error ? error.name : "desconocido",
    });
  }
  return { clienteId };
}

// Datos públicos de una invitación vigente: solo el nombre del asesor.
export async function consultarInvitacion(token: string): Promise<{ nombreAsesor: string }> {
  const [fila] = await getDb()
    .select({ nombre: staffMembers.nombre })
    .from(invitaciones)
    .innerJoin(staffMembers, eq(staffMembers.id, invitaciones.asesorId))
    .where(
      and(
        eq(invitaciones.tokenHash, hashToken(token)),
        isNull(invitaciones.acceptedAt),
        gt(invitaciones.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  if (!fila) {
    throw new ErrorDominio("INVITACION_INVALIDA", "La invitación no es válida o ya venció");
  }
  return { nombreAsesor: fila.nombre };
}

// Aceptación: fija accepted_at (una sola vez), el asesor del cliente y el usuario enlazado.
export async function aceptarInvitacion(actor: Actor, token: string): Promise<void> {
  if (actor.tipo !== "cliente") {
    throw new ErrorDominio("PROHIBIDO", "Solo un cliente puede aceptar una invitación");
  }
  const [invitacion] = await getDb()
    .select({
      id: invitaciones.id,
      clienteId: invitaciones.clienteId,
      asesorId: invitaciones.asesorId,
      email: invitaciones.email,
    })
    .from(invitaciones)
    .where(
      and(
        eq(invitaciones.tokenHash, hashToken(token)),
        isNull(invitaciones.acceptedAt),
        gt(invitaciones.expiresAt, sql`now()`),
      ),
    )
    .limit(1);
  if (!invitacion || invitacion.email !== actor.email.trim().toLowerCase()) {
    throw new ErrorDominio("INVITACION_INVALIDA", "La invitación no es válida o ya venció");
  }

  await conAuditoria(
    {
      accion: "invitacion.aceptar",
      actorId: actor.userId,
      targetType: "cliente",
      targetId: invitacion.clienteId,
      metadata: { invitacionId: invitacion.id },
    },
    async (tx) => {
      // El UPDATE condicionado es el candado de un solo uso: si ya se aceptó, no devuelve filas.
      const marcadas = await tx
        .update(invitaciones)
        .set({ acceptedAt: new Date() })
        .where(and(eq(invitaciones.id, invitacion.id), isNull(invitaciones.acceptedAt)))
        .returning({ id: invitaciones.id });
      if (marcadas.length === 0) {
        throw new ErrorDominio("INVITACION_INVALIDA", "La invitación ya fue usada");
      }
      const enlazados = await tx
        .update(clientes)
        .set({ asesorId: invitacion.asesorId, userId: actor.userId })
        .where(
          and(
            eq(clientes.id, invitacion.clienteId),
            sql`(${clientes.userId} is null or ${clientes.userId} = ${actor.userId})`,
          ),
        )
        .returning({ id: clientes.id });
      if (enlazados.length === 0) {
        throw new ErrorDominio("CONFLICTO", "Este registro ya está vinculado a otra cuenta");
      }
    },
  );
}
