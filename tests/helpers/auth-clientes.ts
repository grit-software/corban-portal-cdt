import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect } from "vitest";
import { POST as authRoute } from "@/app/api/auth/[...all]/route";
import { getEnv } from "@/lib/env";
import { cookieDe } from "@/server/auth/sesion-prueba";
import type { Actor } from "@/server/authz/actor";
import { getDb } from "@/server/db/client";
import { staffMembers } from "@/server/db/schema";

// Ayudas de las pruebas de autenticación de clientes: peticiones reales a los handlers, OTP y
// correos leídos del driver file (MAIL_FILE_DIR), como exige .claude/rules/pruebas.md.

export const BASE = getEnv().BETTER_AUTH_URL;

export function correoUnico(): string {
  return `${randomUUID()}@prueba.co`;
}

export function ipUnica(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

export function documentoUnico(): string {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

// Correos de prueba: el driver file escribe un JSON por correo en MAIL_FILE_DIR.
export type Correo = { para: string; asunto: string; html: string; texto: string };

export async function correosPara(email: string): Promise<Correo[]> {
  const directorio = path.resolve(getEnv().MAIL_FILE_DIR);
  let nombres: string[];
  try {
    nombres = (await readdir(directorio)).sort();
  } catch {
    return [];
  }
  const correos: Correo[] = [];
  for (const nombre of nombres) {
    const correo = JSON.parse(await readFile(path.join(directorio, nombre), "utf8")) as Correo;
    if (correo.para === email) {
      correos.push(correo);
    }
  }
  return correos;
}

// Código de 6 dígitos del último correo de OTP (pruebas.md: /\b(\d{6})\b/ sobre texto).
export async function ultimoOtp(email: string): Promise<string> {
  const correos = await correosPara(email);
  const ultimo = correos.at(-1);
  const coincidencia = /\b(\d{6})\b/.exec(ultimo?.texto ?? "");
  if (!coincidencia?.[1]) {
    throw new Error("No llegó el código OTP");
  }
  return coincidencia[1];
}

export function peticion(
  ruta: string,
  cuerpo: unknown,
  cabeceras: Record<string, string> = {},
): Request {
  return new Request(`${BASE}${ruta}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: new URL(BASE).origin,
      ...cabeceras,
    },
    body: JSON.stringify(cuerpo),
  });
}

export async function enviarOtp(email: string, ip: string): Promise<Response> {
  return authRoute(
    peticion(
      "/api/auth/email-otp/send-verification-otp",
      { email, type: "sign-in" },
      { "x-forwarded-for": ip },
    ),
  );
}

// Inicia sesión como cliente por OTP real y devuelve la cookie de sesión.
export async function ingresarCliente(email: string): Promise<string> {
  await enviarOtp(email, ipUnica());
  const otp = await ultimoOtp(email);
  const respuesta = await authRoute(
    peticion("/api/auth/sign-in/email-otp", { email, otp }, { "x-forwarded-for": ipUnica() }),
  );
  expect(respuesta.status).toBe(200);
  return cookieDe(respuesta);
}

export async function staffDePrueba(
  rol: "asesor" | "coordinador",
): Promise<Actor & { tipo: "staff" }> {
  const email = correoUnico();
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Asesor de prueba", rol })
    .returning({ id: staffMembers.id });
  return {
    tipo: "staff",
    userId: `usr-${randomUUID()}`,
    staffId: fila?.id ?? "",
    rol,
    email,
  };
}
