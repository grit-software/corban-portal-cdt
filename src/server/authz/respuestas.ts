import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { ErrorDominio, HTTP_POR_CODIGO } from "./errores.ts";

// Sobre de éxito: { data }.
export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data }, { status: 200, ...init });
}

// Sobre de error: una sola forma (contratos.md §1). Lo no previsto se registra sin PII.
export function respuestaError(error: unknown, requestId?: string): Response {
  if (error instanceof ErrorDominio) {
    const cuerpo = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      },
    };
    return Response.json(cuerpo, { status: HTTP_POR_CODIGO[error.code] });
  }
  log.error("error no previsto", {
    requestId,
    tipo: error instanceof Error ? error.name : "desconocido",
  });
  return Response.json(
    {
      error: {
        code: "ERROR_INTERNO",
        message: "Ocurrió un error interno. Intenta de nuevo.",
      },
    },
    { status: 500 },
  );
}

// Lee el cuerpo JSON de la petición; un cuerpo inválido es VALIDACION.
export async function leerCuerpo(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ErrorDominio("VALIDACION", "El cuerpo de la petición debe ser JSON válido");
  }
}

// Protección básica de mutaciones: el origen debe ser la URL pública de la aplicación.
export function exigirMismoOrigen(request: Request): void {
  const esperado = new URL(getEnv().BETTER_AUTH_URL).origin;
  if (request.headers.get("origin") !== esperado) {
    throw new ErrorDominio("PROHIBIDO", "Origen de la petición no permitido");
  }
}
