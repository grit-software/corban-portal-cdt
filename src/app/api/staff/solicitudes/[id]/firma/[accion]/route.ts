import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { revisarFirma } from "@/server/firmas/servicio";
import { notificarTransicion } from "@/server/solicitudes/notificaciones";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esquemaRevision = z.object({ motivo: z.string().max(2000).optional() }).strict();

// El asesor (o el coordinador) acepta o rechaza el firmado. Rechazar exige motivo.
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
    if (!UUID.test(id) || (accion !== "aceptar" && accion !== "rechazar")) {
      throw new ErrorDominio("NO_ENCONTRADO", "Acción no disponible");
    }
    const cuerpo = await leerCuerpo(request, esquemaRevision);
    const resultado = await revisarFirma(actor, id, accion, cuerpo.motivo);
    notificarTransicion({ solicitudId: id, accion: `${accion}_firma`, hacia: resultado.estado });
    return ok(resultado);
  } catch (error) {
    return respuestaError(error);
  }
}
