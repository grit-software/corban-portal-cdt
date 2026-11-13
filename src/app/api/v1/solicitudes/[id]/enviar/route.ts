import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ok, respuestaError } from "@/server/authz/respuestas";
import { enviar } from "@/server/solicitudes/servicio";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirMismoOrigen(request);
    const { id } = await contexto.params;
    if (!UUID.test(id)) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
    }
    return ok(await enviar(actor, id));
  } catch (error) {
    return respuestaError(error);
  }
}
