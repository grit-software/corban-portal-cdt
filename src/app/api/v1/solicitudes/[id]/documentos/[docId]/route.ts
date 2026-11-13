import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { respuestaError } from "@/server/authz/respuestas";
import { exigirAcceso } from "@/server/solicitudes/acceso";
import { descargarDocumento } from "@/server/solicitudes/documentos";
import { respuestaDescarga } from "@/server/solicitudes/respuesta-documento";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  contexto: { params: Promise<{ id: string; docId: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirAcceso(actor);
    const { id, docId } = await contexto.params;
    return respuestaDescarga(await descargarDocumento(actor, id, docId));
  } catch (error) {
    return respuestaError(error);
  }
}
