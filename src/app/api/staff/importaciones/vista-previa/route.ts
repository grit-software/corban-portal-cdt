import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ok, respuestaError } from "@/server/authz/respuestas";
import { vistaPrevia } from "@/server/importacion/importar";
import { leerArchivoXlsx, leerMapeo } from "@/server/importacion/subida";

export const dynamic = "force-dynamic";

// Vista previa de una importación: no escribe nada. Multipart con `archivo` y `mapeo` (JSON).
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirMismoOrigen(request);
    const formulario = await request.formData();
    const { bytes } = await leerArchivoXlsx(formulario);
    return ok(await vistaPrevia(actor, bytes, leerMapeo(formulario)));
  } catch (error) {
    return respuestaError(error);
  }
}
