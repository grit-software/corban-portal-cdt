import { getEnv } from "./env.ts";

// Logger de una línea JSON por evento. Redacta recursivamente datos personales y secretos
// (CLAUDE.md, regla 4): nunca deben salir en claro en un log.

const CLAVES_REDACTADAS = new Set([
  "num_doc",
  "numDoc",
  "email",
  "celular",
  "tel_fijo",
  "tel_trab",
  "direccion",
  "cta_numero",
  "ctaNumero",
  "otp",
  "token",
  "password",
  "cookie",
  "authorization",
]);

const PESO_NIVEL = { debug: 10, info: 20, warn: 30, error: 40 } as const;
type Nivel = keyof typeof PESO_NIVEL;

function nivelMinimo(): Nivel {
  try {
    return getEnv().LOG_LEVEL;
  } catch {
    return "info";
  }
}

function redactar(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(redactar);
  }
  if (valor !== null && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([clave, contenido]) => [
        clave,
        CLAVES_REDACTADAS.has(clave) ? "[REDACTADO]" : redactar(contenido),
      ]),
    );
  }
  return valor;
}

function emitir(nivel: Nivel, mensaje: string, datos?: Record<string, unknown>): void {
  if (PESO_NIVEL[nivel] < PESO_NIVEL[nivelMinimo()]) {
    return;
  }
  const linea = JSON.stringify({
    nivel,
    tiempo: new Date().toISOString(),
    mensaje,
    datos: datos === undefined ? undefined : redactar(datos),
  });
  const destino = nivel === "warn" || nivel === "error" ? process.stderr : process.stdout;
  destino.write(`${linea}\n`);
}

export const log = {
  debug: (mensaje: string, datos?: Record<string, unknown>) => emitir("debug", mensaje, datos),
  info: (mensaje: string, datos?: Record<string, unknown>) => emitir("info", mensaje, datos),
  warn: (mensaje: string, datos?: Record<string, unknown>) => emitir("warn", mensaje, datos),
  error: (mensaje: string, datos?: Record<string, unknown>) => emitir("error", mensaje, datos),
};

// Identificador de la petición: el que llegue en la cabecera o uno nuevo.
export function requestIdDe(headers: Headers): string {
  return headers.get("x-request-id") ?? crypto.randomUUID();
}
