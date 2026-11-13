import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Actor, RolStaff } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { type EventoAuditoria, conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { session, staffMembers, user } from "@/server/db/schema";

// Lista blanca de staff: solo un correo que figure aquí (y esté activo) puede entrar como staff.

export type MiembroStaff = { id: string; rol: RolStaff; nombre: string };

type Cambio = { campo: string; antes: unknown; despues: unknown };

export async function buscarStaffActivoPorEmail(email: string): Promise<MiembroStaff | undefined> {
  const [fila] = await getDb()
    .select({ id: staffMembers.id, rol: staffMembers.rol, nombre: staffMembers.nombre })
    .from(staffMembers)
    .where(
      and(
        sql`lower(${staffMembers.email}) = ${email.trim().toLowerCase()}`,
        eq(staffMembers.activo, true),
      ),
    )
    .limit(1);
  return fila;
}

// Cualquier fila de staff para ese correo, activa o no. Un correo de staff nunca pide OTP.
export async function existeStaffPorEmail(email: string): Promise<boolean> {
  const filas = await getDb()
    .select({ id: staffMembers.id })
    .from(staffMembers)
    .where(sql`lower(${staffMembers.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  return filas.length > 0;
}

function codigoDePg(error: unknown): string | undefined {
  const envuelto = error as { cause?: { code?: string }; code?: string };
  return (envuelto.cause ?? envuelto).code;
}

function exigirMotivo(motivo: string | undefined): string {
  const texto = motivo?.trim() ?? "";
  if (texto.length === 0) {
    throw new ErrorDominio("MOTIVO_REQUERIDO", "Indica el motivo del cambio");
  }
  return texto;
}

function exigirAdministrador(actor: Actor): void {
  if (!can(actor, "staff.administrar")) {
    throw new ErrorDominio("PROHIBIDO", "Solo el administrador gestiona el staff");
  }
}

export async function crearStaff(
  actor: Actor,
  datos: { email: string; nombre: string; rol: RolStaff },
): Promise<{ id: string }> {
  exigirAdministrador(actor);
  const email = datos.email.trim().toLowerCase();
  const id = randomUUID();
  try {
    await conAuditoria(
      {
        accion: "staff.crear",
        actorId: actor.userId,
        targetType: "staff",
        targetId: id,
        metadata: { rol: datos.rol },
      },
      async (tx) => {
        await tx.insert(staffMembers).values({ id, email, nombre: datos.nombre, rol: datos.rol });
      },
    );
  } catch (error) {
    if (codigoDePg(error) === "23505") {
      throw new ErrorDominio("CONFLICTO", "Ya existe un miembro del staff con ese correo");
    }
    throw error;
  }
  return { id };
}

export async function cambiarRolStaff(
  actor: Actor,
  datos: { id: string; rol: RolStaff; motivo?: string },
): Promise<void> {
  exigirAdministrador(actor);
  const motivo = exigirMotivo(datos.motivo);
  // conAuditoria lee evento.metadata después del trabajo: los cambios se añaden ahí.
  const evento: EventoAuditoria = {
    accion: "staff.cambiar_rol",
    actorId: actor.userId,
    targetType: "staff",
    targetId: datos.id,
    metadata: { motivo },
  };
  await conAuditoria(evento, async (tx) => {
    const [actual] = await tx
      .select({ rol: staffMembers.rol })
      .from(staffMembers)
      .where(eq(staffMembers.id, datos.id))
      .for("update");
    if (!actual) {
      throw new ErrorDominio("NO_ENCONTRADO", "No existe el miembro del staff");
    }
    await tx.update(staffMembers).set({ rol: datos.rol }).where(eq(staffMembers.id, datos.id));
    const cambios: Cambio[] = [];
    if (actual.rol !== datos.rol) {
      cambios.push({ campo: "rol", antes: actual.rol, despues: datos.rol });
    }
    evento.metadata = { motivo, cambios };
  });
}

export async function desactivarStaff(
  actor: Actor,
  datos: { id: string; motivo?: string },
): Promise<void> {
  exigirAdministrador(actor);
  const motivo = exigirMotivo(datos.motivo);
  const evento: EventoAuditoria = {
    accion: "staff.desactivar",
    actorId: actor.userId,
    targetType: "staff",
    targetId: datos.id,
    metadata: { motivo },
  };
  await conAuditoria(evento, async (tx) => {
    const [miembro] = await tx
      .select({ email: staffMembers.email, activo: staffMembers.activo })
      .from(staffMembers)
      .where(eq(staffMembers.id, datos.id))
      .for("update");
    if (!miembro) {
      throw new ErrorDominio("NO_ENCONTRADO", "No existe el miembro del staff");
    }
    await tx.update(staffMembers).set({ activo: false }).where(eq(staffMembers.id, datos.id));
    // Al desactivar se borran sus sesiones: la cookie anterior deja de valer.
    const usuarios = await tx
      .select({ id: user.id })
      .from(user)
      .where(sql`lower(${user.email}) = ${miembro.email.toLowerCase()}`);
    const ids = usuarios.map((u) => u.id);
    if (ids.length > 0) {
      await tx.delete(session).where(inArray(session.userId, ids));
    }
    const cambios: Cambio[] = [];
    if (miembro.activo) {
      cambios.push({ campo: "activo", antes: true, despues: false });
    }
    evento.metadata = { motivo, cambios };
  });
}
