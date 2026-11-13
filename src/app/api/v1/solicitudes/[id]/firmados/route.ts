import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { exigirMismoOrigen, ok, respuestaError } from "@/server/authz/respuestas";
import { MAX_ARCHIVOS, MAX_BYTES_TOTAL, cargarFirmados } from "@/server/firmas/servicio";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Carga del firmado: límites por número y tamaño ANTES de leer los bytes (api-v1.md).
export async function POST(
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

    const formulario = await request.formData();
    const entradas = formulario.getAll("archivos").filter((x): x is File => x instanceof File);
    if (entradas.length === 0) {
      throw new ErrorDominio("VALIDACION", "Adjunta al menos un archivo");
    }
    if (entradas.length > MAX_ARCHIVOS) {
      throw new ErrorDominio("CARGA_DEMASIADO_GRANDE", `Máximo ${MAX_ARCHIVOS} archivos por carga`);
    }
    const total = entradas.reduce((suma, archivo) => suma + archivo.size, 0);
    if (total > MAX_BYTES_TOTAL) {
      throw new ErrorDominio("CARGA_DEMASIADO_GRANDE", "La carga supera los 15 MB en total");
    }

    const archivos = await Promise.all(
      entradas.map(async (archivo) => ({
        nombre: archivo.name,
        bytes: new Uint8Array(await archivo.arrayBuffer()),
      })),
    );
    return ok(await cargarFirmados(actor, id, archivos));
  } catch (error) {
    return respuestaError(error);
  }
}
