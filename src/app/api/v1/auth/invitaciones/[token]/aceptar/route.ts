import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ok, respuestaError } from "@/server/authz/respuestas";
import { aceptarInvitacion } from "@/server/clientes/acceso/invitacion";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  contexto: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para aceptar la invitación");
    }
    exigirMismoOrigen(request);
    const { token } = await contexto.params;
    await aceptarInvitacion(actor, token);
    return ok({ aceptada: true });
  } catch (error) {
    return respuestaError(error);
  }
}
