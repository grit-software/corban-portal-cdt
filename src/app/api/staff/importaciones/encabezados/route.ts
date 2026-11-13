import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ok, respuestaError } from "@/server/authz/respuestas";
import { encabezadosDe } from "@/server/importacion/importar";
import { leerArchivoXlsx } from "@/server/importacion/subida";

export const dynamic = "force-dynamic";

// Encabezados de la primera hoja, para armar el mapeo de columnas. Multipart con `archivo`.
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirMismoOrigen(request);
    const { bytes } = await leerArchivoXlsx(await request.formData());
    return ok({ encabezados: await encabezadosDe(actor, bytes) });
  } catch (error) {
    return respuestaError(error);
  }
}
