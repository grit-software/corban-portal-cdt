import type { ZodType } from "zod";
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

// 429 LIMITE_EXCEDIDO con cabecera Retry-After en segundos.
export function respuestaLimite(reintentarEn: number): Response {
  const respuesta = respuestaError(
    new ErrorDominio("LIMITE_EXCEDIDO", "Demasiados intentos. Espera e intenta de nuevo."),
  );
  respuesta.headers.set("Retry-After", String(reintentarEn));
  return respuesta;
}

// Lee el cuerpo JSON y lo valida con el esquema zod del borde. Inválido → 422 VALIDACION con fields.
export async function leerCuerpo<T>(request: Request, esquema: ZodType<T>): Promise<T> {
  const crudo: unknown = await request.json().catch(() => undefined);
  if (crudo === undefined) {
    throw new ErrorDominio("VALIDACION", "El cuerpo de la petición debe ser JSON válido");
  }
  const resultado = esquema.safeParse(crudo);
  if (!resultado.success) {
    const campos: Record<string, string> = {};
    for (const problema of resultado.error.issues) {
      const clave = problema.path.map(String).join(".") || "cuerpo";
      campos[clave] ??= problema.message;
    }
    throw new ErrorDominio("VALIDACION", "Revisa los campos marcados", campos);
  }
  return resultado.data;
}

// Protección de mutaciones: el origen debe ser la URL pública de la aplicación.
export function exigirMismoOrigen(request: Request): void {
  const esperado = new URL(getEnv().BETTER_AUTH_URL).origin;
  if (request.headers.get("origin") !== esperado) {
    throw new ErrorDominio("PROHIBIDO", "Origen de la petición no permitido");
  }
}

// Dirección del cliente para límites de tasa: primer valor de x-forwarded-for.
export function ipDe(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "desconocida";
}
