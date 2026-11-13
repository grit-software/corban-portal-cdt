import { consumirLimite } from "@/server/auth/limite";
import {
  exigirMismoOrigen,
  ipDe,
  leerCuerpo,
  ok,
  respuestaError,
  respuestaLimite,
} from "@/server/authz/respuestas";
import { esquemaRegistro } from "@/server/clientes/acceso/esquemas";
import { registrarCliente } from "@/server/clientes/acceso/registro";

export const dynamic = "force-dynamic";

// Registro público: no hay sesión (getActor no aplica), pero sí origen, límite y validación.
export async function POST(request: Request): Promise<Response> {
  try {
    exigirMismoOrigen(request);
    const limite = await consumirLimite(`registro:${ipDe(request)}`, 10, 900);
    if (!limite.permitido) {
      return respuestaLimite(limite.reintentarEn);
    }
    const datos = await leerCuerpo(request, esquemaRegistro);
    const resultado = await registrarCliente(datos);
    return ok({ id: resultado.id, creado: resultado.creado }, { status: 201 });
  } catch (error) {
    return respuestaError(error);
  }
}
