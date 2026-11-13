import { z } from "zod";
import { ErrorDominio } from "@/server/authz/errores";
import type { Mapeo } from "@/server/importacion/normalizar";

// Lectura de la subida multipart de importación. El tamaño se valida antes de leer bytes y el tipo
// por la firma del archivo (un .xlsx es un zip: empieza por "PK"), no por el MIME.

export const TAMANO_MAXIMO_XLSX = 5 * 1024 * 1024;

export async function leerArchivoXlsx(
  formulario: FormData,
): Promise<{ bytes: Uint8Array; nombre: string }> {
  const archivo = formulario.get("archivo");
  if (!(archivo instanceof File)) {
    throw new ErrorDominio("VALIDACION", "Sube un archivo .xlsx", { archivo: "Falta el archivo" });
  }
  if (archivo.size > TAMANO_MAXIMO_XLSX) {
    throw new ErrorDominio("VALIDACION", "El archivo supera 5 MB", { archivo: "Máximo 5 MB" });
  }
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new ErrorDominio("VALIDACION", "El archivo no es un .xlsx", {
      archivo: "Sube un archivo Excel .xlsx",
    });
  }
  return { bytes, nombre: archivo.name };
}

const esquemaMapeo = z.record(z.string(), z.string());

export function leerMapeo(formulario: FormData): Mapeo {
  const crudo = formulario.get("mapeo");
  let json: unknown;
  try {
    json = JSON.parse(typeof crudo === "string" ? crudo : "");
  } catch {
    throw new ErrorDominio("VALIDACION", "El mapeo de columnas no es válido", {
      mapeo: "Revisa las columnas",
    });
  }
  const resultado = esquemaMapeo.safeParse(json);
  if (!resultado.success) {
    throw new ErrorDominio("VALIDACION", "El mapeo de columnas no es válido", {
      mapeo: "Revisa las columnas",
    });
  }
  return resultado.data;
}
