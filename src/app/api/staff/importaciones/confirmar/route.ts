import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ok, respuestaError } from "@/server/authz/respuestas";
import { confirmar } from "@/server/importacion/importar";
import { leerArchivoXlsx, leerMapeo } from "@/server/importacion/subida";

export const dynamic = "force-dynamic";

// Confirma la importación por bloques. Multipart con `archivo`, `mapeo` (JSON) y `perfilId`.
export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirMismoOrigen(request);
    const formulario = await request.formData();
    const { bytes, nombre } = await leerArchivoXlsx(formulario);
    const perfilId = formulario.get("perfilId");
    if (typeof perfilId !== "string" || perfilId === "") {
      throw new ErrorDominio("VALIDACION", "Elige un perfil de mapeo", {
        perfilId: "Falta el perfil",
      });
    }
    return ok(
      await confirmar(actor, {
        bytes,
        nombreArchivo: nombre,
        mapeo: leerMapeo(formulario),
        perfilId,
      }),
    );
  } catch (error) {
    return respuestaError(error);
  }
}
