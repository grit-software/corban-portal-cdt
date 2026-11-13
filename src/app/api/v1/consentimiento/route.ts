import { VERSION_CONSENTIMIENTO, getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ipDe, ok, respuestaError } from "@/server/authz/respuestas";
import { registrarConsentimiento } from "@/server/clientes/acceso/consentimiento";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    const aceptado = actor.tipo === "cliente" && actor.consentimiento;
    return ok({ aceptado, version: VERSION_CONSENTIMIENTO });
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
    await registrarConsentimiento(actor, {
      ip: ipDe(request),
      userAgent: request.headers.get("user-agent") ?? "desconocido",
    });
    return ok({ aceptado: true, version: VERSION_CONSENTIMIENTO });
  } catch (error) {
    return respuestaError(error);
  }
}
