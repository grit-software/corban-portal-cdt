import { and, eq, isNull, sql } from "drizzle-orm";
import type { Actor, ActorCliente } from "@/server/authz/actor";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { clientes, consentimientos } from "@/server/db/schema";
import { getAuth } from "./auth.ts";
import { buscarStaffActivoPorEmail } from "./staff.ts";

// Versión del texto de consentimiento Ley 1581 vigente (contratos.md §8).
export const VERSION_CONSENTIMIENTO = "2026-11-v1";

const DOCE_HORAS_MS = 12 * 60 * 60 * 1000;

// Único lector de la sesión. Devuelve null si no hay sesión válida.
export async function getActor(headers: Headers): Promise<Actor | null> {
  const sesion = await getAuth().api.getSession({ headers });
  if (!sesion) {
    return null;
  }
  const usuario = sesion.user;

  const staff = await buscarStaffActivoPorEmail(usuario.email);
  if (staff) {
    if (Date.now() - new Date(sesion.session.createdAt).getTime() > DOCE_HORAS_MS) {
      return null;
    }
    return {
      tipo: "staff",
      userId: usuario.id,
      staffId: staff.id,
      rol: staff.rol,
      email: usuario.email,
    };
  }

  const clienteId = await clienteDeUsuario(usuario.id, usuario.email);
  const consentimiento = await tieneConsentimiento(usuario.id);
  const actor: ActorCliente = {
    tipo: "cliente",
    userId: usuario.id,
    clienteId,
    email: usuario.email,
    consentimiento,
  };
  return actor;
}

// Enlaza el registro de cliente con el usuario por correo, si aún no está enlazado.
async function clienteDeUsuario(userId: string, email: string): Promise<string | null> {
  const db = getDb();
  const [vinculado] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.userId, userId), isNull(clientes.deletedAt)))
    .limit(1);
  if (vinculado) {
    return vinculado.id;
  }
  const [porCorreo] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(
      and(
        isNull(clientes.userId),
        isNull(clientes.deletedAt),
        sql`lower(${clientes.email}) = ${email.trim().toLowerCase()}`,
      ),
    )
    .limit(1);
  if (!porCorreo) {
    return null;
  }
  await conAuditoria(
    {
      accion: "cliente.enlazar",
      actorId: userId,
      targetType: "cliente",
      targetId: porCorreo.id,
    },
    async (tx) => {
      await tx
        .update(clientes)
        .set({ userId })
        .where(and(eq(clientes.id, porCorreo.id), isNull(clientes.userId)));
    },
  );
  return porCorreo.id;
}

async function tieneConsentimiento(userId: string): Promise<boolean> {
  const [fila] = await getDb()
    .select({ id: consentimientos.id })
    .from(consentimientos)
    .where(
      and(eq(consentimientos.userId, userId), eq(consentimientos.version, VERSION_CONSENTIMIENTO)),
    )
    .limit(1);
  return fila !== undefined;
}
