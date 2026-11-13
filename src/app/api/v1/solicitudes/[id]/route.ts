import { z } from "zod";
import { PASOS } from "@/lib/datos/esquemas";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { actualizarPaso, obtenerSolicitud } from "@/server/solicitudes/servicio";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esquemaPaso = z.object({
  paso: z.enum(PASOS, { error: "Elige un paso válido" }),
  datos: z.record(z.string(), z.unknown()),
});

// Un id que no es UUID no existe para nadie: NO_ENCONTRADO, no un error de base de datos.
function idValido(id: string): string {
  if (!UUID.test(id)) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
  }
  return id;
}

export async function GET(
  request: Request,
  contexto: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    const { id } = await contexto.params;
    return ok(await obtenerSolicitud(actor, idValido(id)));
  } catch (error) {
    return respuestaError(error);
  }
}

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
    const cuerpo = await leerCuerpo(request, esquemaPaso);
    return ok(await actualizarPaso(actor, idValido(id), cuerpo.paso, cuerpo.datos));
  } catch (error) {
    return respuestaError(error);
  }
}
