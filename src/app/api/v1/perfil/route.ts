import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, leerCuerpo, ok, respuestaError } from "@/server/authz/respuestas";
import { esquemaPerfil } from "@/lib/datos/esquemas";
import { actualizarPerfil, obtenerPerfil } from "@/server/solicitudes/perfil";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    return ok(await obtenerPerfil(actor));
  } catch (error) {
    return respuestaError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    exigirMismoOrigen(request);
    const datos = await leerCuerpo(request, esquemaPerfil);
    return ok(await actualizarPerfil(actor, datos as Record<string, string>));
  } catch (error) {
    return respuestaError(error);
  }
}
