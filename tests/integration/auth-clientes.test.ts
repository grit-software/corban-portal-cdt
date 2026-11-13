import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { POST as aceptarInvitacionRoute } from "@/app/api/v1/auth/invitaciones/[token]/aceptar/route";
import { POST as registroRoute } from "@/app/api/v1/auth/registro/route";
import {
  POST as consentimientoPost,
  GET as consentimientoGet,
} from "@/app/api/v1/consentimiento/route";
import { POST as authRoute } from "@/app/api/auth/[...all]/route";
import { getEnv } from "@/lib/env";
import { getActor } from "@/server/auth/actor";
import { cookieDe } from "@/server/auth/sesion-prueba";
import type { Actor } from "@/server/authz/actor";
import { crearInvitacion, hashToken } from "@/server/clientes/acceso/invitacion";
import { cerrarDb, getDb } from "@/server/db/client";
import { clientes, invitaciones, staffMembers } from "@/server/db/schema";

const BASE = getEnv().BETTER_AUTH_URL;

function correoUnico(): string {
  return `${randomUUID()}@prueba.co`;
}

function ipUnica(): string {
  return `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function documentoUnico(): string {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

// Correos de prueba: el driver file escribe un JSON por correo en MAIL_FILE_DIR.
type Correo = { para: string; asunto: string; html: string; texto: string };

async function correosPara(email: string): Promise<Correo[]> {
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

// Código de 6 dígitos del último correo de OTP (contratos y pruebas: /\b(\d{6})\b/ sobre texto).
async function ultimoOtp(email: string): Promise<string> {
  const correos = await correosPara(email);
  const ultimo = correos.at(-1);
  const coincidencia = /\b(\d{6})\b/.exec(ultimo?.texto ?? "");
  if (!coincidencia?.[1]) {
    throw new Error("No llegó el código OTP");
  }
  return coincidencia[1];
}

function peticion(ruta: string, cuerpo: unknown, cabeceras: Record<string, string> = {}): Request {
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

async function enviarOtp(email: string, ip: string): Promise<Response> {
  return authRoute(
    peticion(
      "/api/auth/email-otp/send-verification-otp",
      { email, type: "sign-in" },
      { "x-forwarded-for": ip },
    ),
  );
}

async function ingresarCliente(email: string): Promise<string> {
  await enviarOtp(email, ipUnica());
  const otp = await ultimoOtp(email);
  const respuesta = await authRoute(
    peticion("/api/auth/sign-in/email-otp", { email, otp }, { "x-forwarded-for": ipUnica() }),
  );
  expect(respuesta.status).toBe(200);
  return cookieDe(respuesta);
}

async function staffDePrueba(rol: "asesor" | "coordinador") {
  const email = correoUnico();
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Asesor de prueba", rol })
    .returning({ id: staffMembers.id });
  const actor: Actor = {
    tipo: "staff",
    userId: `usr-${randomUUID()}`,
    staffId: fila?.id ?? "",
    rol,
    email,
  };
  return actor;
}

describe("autenticación de clientes", () => {
  afterAll(cerrarDb);

  it("registro: crea el cliente sin usuario, no duplica y rechaza otro correo (201 / 409)", async () => {
    const numDoc = documentoUnico();
    const email = correoUnico();
    const datos = { tipoDoc: "CC", numDoc, nombre: "Cliente Prueba", email };

    const primera = await registroRoute(
      peticion("/api/v1/auth/registro", datos, { "x-forwarded-for": ipUnica() }),
    );
    expect(primera.status).toBe(201);

    const [fila] = await getDb()
      .select({ userId: clientes.userId })
      .from(clientes)
      .where(and(eq(clientes.tipoDoc, "CC"), eq(clientes.numDoc, numDoc)));
    expect(fila?.userId).toBeNull();

    const repetida = await registroRoute(
      peticion("/api/v1/auth/registro", datos, { "x-forwarded-for": ipUnica() }),
    );
    expect(repetida.status).toBe(201);
    const filas = await getDb()
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.numDoc, numDoc));
    expect(filas).toHaveLength(1);

    const otroCorreo = await registroRoute(
      peticion(
        "/api/v1/auth/registro",
        { ...datos, email: correoUnico() },
        { "x-forwarded-for": ipUnica() },
      ),
    );
    expect(otroCorreo.status).toBe(409);
    expect((await otroCorreo.json()).error.code).toBe("DOCUMENTO_REGISTRADO");
  });

  it("registro: la undécima petición desde la misma IP responde 429", async () => {
    const ip = ipUnica();
    for (let i = 0; i < 10; i += 1) {
      const respuesta = await registroRoute(
        peticion(
          "/api/v1/auth/registro",
          { tipoDoc: "CC", numDoc: documentoUnico(), nombre: "Limite", email: correoUnico() },
          { "x-forwarded-for": ip },
        ),
      );
      expect(respuesta.status).toBe(201);
    }
    const undecima = await registroRoute(
      peticion(
        "/api/v1/auth/registro",
        { tipoDoc: "CC", numDoc: documentoUnico(), nombre: "Limite", email: correoUnico() },
        { "x-forwarded-for": ip },
      ),
    );
    expect(undecima.status).toBe(429);
    expect(undecima.headers.get("retry-after")).not.toBeNull();
    expect((await undecima.json()).error.code).toBe("LIMITE_EXCEDIDO");
  });

  it("OTP: la sexta solicitud en 15 minutos responde 429 y no escribe correo", async () => {
    const email = correoUnico();
    const ip = ipUnica();
    for (let i = 0; i < 5; i += 1) {
      expect((await enviarOtp(email, ip)).status).toBe(200);
    }
    const antes = (await correosPara(email)).length;
    const sexta = await enviarOtp(email, ip);
    expect(sexta.status).toBe(429);
    expect((await sexta.json()).error.code).toBe("LIMITE_EXCEDIDO");
    expect((await correosPara(email)).length).toBe(antes);
  });

  it("OTP: el código correcto crea sesión y enlaza el cliente; el incorrecto no crea sesión", async () => {
    const email = correoUnico();
    const numDoc = documentoUnico();
    const [cliente] = await getDb()
      .insert(clientes)
      .values({ tipoDoc: "CC", numDoc, email, nombre: "Enlace", origen: "registro" })
      .returning({ id: clientes.id });

    await enviarOtp(email, ipUnica());
    const incorrecta = await authRoute(
      peticion(
        "/api/auth/sign-in/email-otp",
        { email, otp: "000000" },
        { "x-forwarded-for": ipUnica() },
      ),
    );
    expect(incorrecta.status).toBeGreaterThanOrEqual(400);
    expect(incorrecta.headers.getSetCookie()).toHaveLength(0);

    const otp = await ultimoOtp(email);
    const correcta = await authRoute(
      peticion("/api/auth/sign-in/email-otp", { email, otp }, { "x-forwarded-for": ipUnica() }),
    );
    expect(correcta.status).toBe(200);
    const actor = await getActor(new Headers({ cookie: cookieDe(correcta) }));
    expect(actor?.tipo).toBe("cliente");
    if (actor?.tipo === "cliente") {
      expect(actor.clienteId).toBe(cliente?.id);
    }
  });

  it("OTP por HTTP: un correo de staff responde 403 USAR_MICROSOFT", async () => {
    const staff = await staffDePrueba("asesor");
    const respuesta = await enviarOtp(staff.email, ipUnica());
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error.code).toBe("USAR_MICROSOFT");
  });

  it("invitación: aceptarla fija el asesor y el usuario; repetirla o vencida responde 410", async () => {
    const asesor = await staffDePrueba("asesor");
    const email = correoUnico();
    await crearInvitacion(asesor, {
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      nombre: "Invitado",
      email,
    });

    const correo = (await correosPara(email)).at(-1);
    const token = /invitacion\/([A-Za-z0-9_-]+)/.exec(correo?.texto ?? "")?.[1] ?? "";
    expect(token.length).toBeGreaterThan(20);

    const cookie = await ingresarCliente(email);
    const aceptada = await aceptarInvitacionRoute(
      peticion(`/api/v1/auth/invitaciones/${token}/aceptar`, {}, { cookie }),
      { params: Promise.resolve({ token }) },
    );
    expect(aceptada.status).toBe(200);

    const [fila] = await getDb()
      .select({ asesorId: clientes.asesorId })
      .from(clientes)
      .where(eq(clientes.email, email));
    expect(fila?.asesorId).toBe(asesor.staffId);

    const repetida = await aceptarInvitacionRoute(
      peticion(`/api/v1/auth/invitaciones/${token}/aceptar`, {}, { cookie }),
      { params: Promise.resolve({ token }) },
    );
    expect(repetida.status).toBe(410);
    expect((await repetida.json()).error.code).toBe("INVITACION_INVALIDA");
  });

  it("invitación vencida (más de 7 días) responde 410", async () => {
    const asesor = await staffDePrueba("asesor");
    const email = correoUnico();
    const [cliente] = await getDb()
      .insert(clientes)
      .values({
        tipoDoc: "CC",
        numDoc: documentoUnico(),
        email,
        nombre: "Vencido",
        origen: "invitacion",
        asesorId: asesor.staffId,
      })
      .returning({ id: clientes.id });
    const token = randomBytes(32).toString("base64url");
    await getDb()
      .insert(invitaciones)
      .values({
        clienteId: cliente?.id ?? "",
        asesorId: asesor.staffId,
        email,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 1000),
      });

    const cookie = await ingresarCliente(email);
    const respuesta = await aceptarInvitacionRoute(
      peticion(`/api/v1/auth/invitaciones/${token}/aceptar`, {}, { cookie }),
      { params: Promise.resolve({ token }) },
    );
    expect(respuesta.status).toBe(410);
  });

  it("consentimiento: se guarda una vez y GET devuelve aceptado true", async () => {
    const email = correoUnico();
    await getDb().insert(clientes).values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Consiente",
      origen: "registro",
    });
    const cookie = await ingresarCliente(email);

    const antes = await consentimientoGet(
      new Request(`${BASE}/api/v1/consentimiento`, { headers: { cookie } }),
    );
    expect((await antes.json()).data.aceptado).toBe(false);

    const aceptado = await consentimientoPost(
      peticion("/api/v1/consentimiento", {}, { cookie, "user-agent": "prueba" }),
    );
    expect(aceptado.status).toBe(200);

    const despues = await consentimientoGet(
      new Request(`${BASE}/api/v1/consentimiento`, { headers: { cookie } }),
    );
    const cuerpo = await despues.json();
    expect(cuerpo.data.aceptado).toBe(true);
    expect(cuerpo.data.version).toBe("2026-11-v1");
  });
});
