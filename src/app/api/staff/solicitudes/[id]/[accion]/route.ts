import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { aprobar } from "@/server/solicitudes/aprobacion";
import { cancelar, devolver, enviarEntidad } from "@/server/solicitudes/acciones";
import { notificarTransicion } from "@/server/solicitudes/notificaciones";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esquemaCuerpo = z
  .object({
    observacion: z.string().max(2000).optional(),
    motivo: z.string().max(2000).optional(),
    fechaEnvio: z.string().optional(),
    radicado: z.string().max(100).optional(),
  })
  .strict();

const ACCIONES = ["aprobar", "devolver", "cancelar", "enviar_entidad"] as const;
type AccionStaff = (typeof ACCIONES)[number];

// Acciones del equipo sobre una solicitud. Cada una valida su dato antes de la transición.
export async function POST(
  request: Request,
  contexto: { params: Promise<{ id: string; accion: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    if (actor.tipo !== "staff") {
      throw new ErrorDominio("PROHIBIDO", "Esta acción es solo para el equipo");
    }
    exigirMismoOrigen(request);
    const { id, accion } = await contexto.params;
    if (!UUID.test(id) || !(ACCIONES as readonly string[]).includes(accion)) {
      throw new ErrorDominio("NO_ENCONTRADO", "Acción no disponible");
    }
    const cuerpo = await leerCuerpo(request, esquemaCuerpo);

    const resultado = await despachar(accion as AccionStaff, actor, id, cuerpo);
    // Notificación después del commit: si falla, no revierte nada.
    notificarTransicion({ solicitudId: id, accion, hacia: resultado.hacia });
    return ok(resultado);
  } catch (error) {
    return respuestaError(error);
  }
}

async function despachar(
  accion: AccionStaff,
  actor: Parameters<typeof aprobar>[0],
  id: string,
  cuerpo: z.infer<typeof esquemaCuerpo>,
) {
  switch (accion) {
    case "aprobar":
      return aprobar(actor, id);
    case "devolver":
      return devolver(actor, id, cuerpo.observacion);
    case "cancelar":
      return cancelar(actor, id, cuerpo.motivo);
    case "enviar_entidad":
      return enviarEntidad(actor, id, { fechaEnvio: cuerpo.fechaEnvio, radicado: cuerpo.radicado });
  }
}
