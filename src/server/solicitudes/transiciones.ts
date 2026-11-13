import { eq } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { type Tx, conAuditoria } from "@/server/auditoria/conAuditoria";
import { solicitudes } from "@/server/db/schema";
import { type Accion, transicionValida } from "./estados.ts";
import { aplicarTransicion } from "./transicion.ts";

// Punto de entrada de todas las transiciones (contratos.md §3). En una transacción: bloquea la
// fila, verifica permiso con can(), valida la transición, ejecuta el efecto, escribe el evento y
// la auditoría `solicitud.<acción>`. Si algo falla, no queda nada escrito.

export type FilaSolicitud = typeof solicitudes.$inferSelect;

// Acción → permiso de can(). El recurso (cliente y asesor) se toma de la fila bloqueada.
const PERMISO: Partial<Record<Accion, string>> = {
  enviar: "solicitud.enviar",
  aprobar: "solicitud.aprobar",
  devolver: "solicitud.devolver",
  cancelar: "solicitud.cancelar",
  enviar_entidad: "solicitud.enviar_entidad",
  cargar_firma: "solicitud.cargar_firma",
  editar_post_aprobacion: "solicitud.editar",
  aceptar_firma: "solicitud.revisar_firma",
  rechazar_firma: "solicitud.revisar_firma",
};

export type EntradaTransicion = { nota?: string | null; metadata?: Record<string, unknown> };
export type Efecto = (tx: Tx, fila: FilaSolicitud) => Promise<void>;

export async function ejecutarTransicion(
  actor: Actor,
  solicitudId: string,
  accion: Accion,
  entrada: EntradaTransicion = {},
  efecto?: Efecto,
): Promise<{ desde: string; hacia: string }> {
  const permiso = PERMISO[accion];
  if (!permiso) {
    throw new ErrorDominio("TRANSICION_INVALIDA", "Esta acción todavía no está disponible");
  }
  const evento = {
    accion: `solicitud.${accion}`,
    actorId: actor.userId,
    targetType: "solicitud",
    targetId: solicitudId,
    metadata: {} as Record<string, unknown>,
  };

  return conAuditoria(evento, async (tx) => {
    const [fila] = await tx
      .select()
      .from(solicitudes)
      .where(eq(solicitudes.id, solicitudId))
      .for("update");
    if (!fila) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
    }
    const recurso = { clienteId: fila.clienteId, asesorId: fila.asesorId };
    if (!can(actor, permiso, recurso)) {
      throw new ErrorDominio("PROHIBIDO", "No puedes realizar esta acción sobre la solicitud");
    }
    if (!transicionValida(accion, fila.estado)) {
      throw new ErrorDominio(
        "TRANSICION_INVALIDA",
        `La solicitud no puede pasar por «${accion}» desde su estado actual`,
      );
    }
    if (efecto) {
      await efecto(tx, fila);
    }
    const resultado = await aplicarTransicion(tx, {
      solicitudId,
      accion,
      actorUserId: actor.userId,
      nota: entrada.nota ?? null,
    });
    // Los metadatos de la entrada (p. ej. los diffs de una edición) van junto a desde y hacia.
    evento.metadata = {
      ...(entrada.metadata ?? {}),
      desde: resultado.desde,
      hacia: resultado.hacia,
    };
    return resultado;
  });
}
