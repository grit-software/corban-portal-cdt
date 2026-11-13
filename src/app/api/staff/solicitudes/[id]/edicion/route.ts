import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { editarConMotivo } from "@/server/solicitudes/edicion";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esquemaEdicion = z
  .object({
    motivo: z.string().max(2000).optional(),
    cambios: z.record(z.string(), z.unknown()),
  })
  .strict();

// Edición del equipo con motivo. Sin motivo responde 422 MOTIVO_REQUERIDO.
export async function PATCH(
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
    const cuerpo = await leerCuerpo(request, esquemaEdicion);
    await editarConMotivo(actor, id, cuerpo);
    return ok({ editada: true });
  } catch (error) {
    return respuestaError(error);
  }
}
