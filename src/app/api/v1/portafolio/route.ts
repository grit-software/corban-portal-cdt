import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { ok, respuestaError } from "@/server/authz/respuestas";
import { portafolioDe } from "@/server/portafolio/consultas";

export const dynamic = "force-dynamic";

// Portafolio del cliente dueño: sus CDT vigentes, el total invertido y los próximos vencimientos.
export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    return ok(await portafolioDe(actor));
  } catch (error) {
    return respuestaError(error);
  }
}
