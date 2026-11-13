import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { respuestaError } from "@/server/authz/respuestas";
import { rechazosDe } from "@/server/importacion/importar";

export const dynamic = "force-dynamic";

// Descarga del .xlsx de rechazos de una carga. Nunca expone la ruta de almacenamiento.
export async function GET(
  request: Request,
  context: { params: Promise<{ cargaId: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    const { cargaId } = await context.params;
    const { nombre, bytes } = await rechazosDe(actor, cargaId);
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${nombre}"`,
      },
    });
  } catch (error) {
    return respuestaError(error);
  }
}
