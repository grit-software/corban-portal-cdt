import { respuestaError, ok } from "@/server/authz/respuestas";
import { consultarInvitacion } from "@/server/clientes/acceso/invitacion";

export const dynamic = "force-dynamic";

// Vista pública de una invitación: solo el nombre del asesor, nunca el correo ni el cliente.
export async function GET(
  _request: Request,
  contexto: { params: Promise<{ token: string }> },
): Promise<Response> {
  try {
    const { token } = await contexto.params;
    return ok(await consultarInvitacion(token));
  } catch (error) {
    return respuestaError(error);
  }
}
