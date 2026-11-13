import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { crearBorrador, listarMias } from "@/server/solicitudes/servicio";

export const dynamic = "force-dynamic";

const esquemaNueva = z.object({
  entidadId: z.string().min(1, "Elige una entidad"),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    return ok(await listarMias(actor));
  } catch (error) {
    return respuestaError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirMismoOrigen(request);
    const entrada = await leerCuerpo(request, esquemaNueva);
    return ok(await crearBorrador(actor, entrada), { status: 201 });
  } catch (error) {
    return respuestaError(error);
  }
}
