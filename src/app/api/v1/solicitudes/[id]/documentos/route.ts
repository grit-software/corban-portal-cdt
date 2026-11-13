import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { ok, respuestaError } from "@/server/authz/respuestas";
import { exigirAcceso } from "@/server/solicitudes/acceso";
import { listarDocumentos } from "@/server/solicitudes/documentos";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirAcceso(actor);
    const { id } = await contexto.params;
    return ok(await listarDocumentos(actor, id));
  } catch (error) {
    return respuestaError(error);
  }
}
