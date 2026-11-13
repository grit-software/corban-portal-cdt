import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { reasignarCliente } from "@/server/solicitudes/reasignacion";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esquemaReasignar = z
  .object({ asesorId: z.string().regex(UUID, "Elige un asesor válido") })
  .strict();

// Reasignación de un cliente: solo el coordinador (la guarda está en el servicio).
export async function POST(
  request: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    if (actor.tipo !== "staff") {
      throw new ErrorDominio("PROHIBIDO", "Esta acción es solo para el equipo");
    }
    exigirMismoOrigen(request);
    const { id } = await contexto.params;
    if (!UUID.test(id)) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos ese cliente");
    }
    const cuerpo = await leerCuerpo(request, esquemaReasignar);
    await reasignarCliente(actor, id, cuerpo.asesorId);
    return ok({ reasignado: true });
  } catch (error) {
    return respuestaError(error);
  }
}
