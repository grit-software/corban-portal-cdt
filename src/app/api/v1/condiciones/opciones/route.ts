import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { ok, respuestaError } from "@/server/authz/respuestas";
import { opcionesPara } from "@/server/condiciones/opciones";

export const dynamic = "force-dynamic";

// Plazos y periodicidades con condición vigente hoy para una entidad y un valor.
const esquemaConsulta = z.object({
  entidadId: z.string().min(1, "Elige una entidad"),
  valor: z.string().regex(/^\d{1,15}$/, "El valor va solo en dígitos"),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    const consulta = esquemaConsulta.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!consulta.success) {
      const campos: Record<string, string> = {};
      for (const problema of consulta.error.issues) {
        campos[problema.path.map(String).join(".") || "consulta"] ??= problema.message;
      }
      throw new ErrorDominio("VALIDACION", "Revisa la consulta", campos);
    }
    const opciones = await opcionesPara(
      actor,
      consulta.data.entidadId,
      Number(consulta.data.valor),
    );
    return ok(opciones);
  } catch (error) {
    return respuestaError(error);
  }
}
