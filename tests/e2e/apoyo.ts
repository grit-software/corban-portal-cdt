import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

// Ayudas de los e2e del asistente. Todo pasa por los endpoints reales: el mismo registro, OTP y
// consentimiento que haría un cliente. Los códigos se leen del driver file (MAIL_FILE_DIR).

// Origen de la aplicación en e2e (playwright.config.ts: BETTER_AUTH_URL). Las mutaciones lo exigen.
const ORIGEN_E2E = "http://127.0.0.1:3200";
const DIRECTORIO_CORREO = ".data/e2e-mail";

export async function iniciarSesionStaff(page: Page, email = "coordinador.e2e@corbanfc.com") {
  const respuesta = await page.request.post("/api/test/login", { data: { email } });
  expect(respuesta.ok()).toBe(true);
}

// Último código de 6 dígitos enviado a ese correo.
export async function leerOtp(email: string): Promise<string> {
  const nombres = (await readdir(path.resolve(DIRECTORIO_CORREO))).sort();
  let ultimo: { texto: string } | undefined;
  for (const nombre of nombres) {
    const correo = JSON.parse(
      await readFile(path.join(path.resolve(DIRECTORIO_CORREO), nombre), "utf8"),
    ) as { para: string; texto: string };
    if (correo.para === email) {
      ultimo = correo;
    }
  }
  const coincidencia = /\b(\d{6})\b/.exec(ultimo?.texto ?? "");
  if (!coincidencia?.[1]) {
    throw new Error(`No llegó código OTP para ${email}`);
  }
  return coincidencia[1];
}

// Registro, código por correo, inicio de sesión y consentimiento: deja la sesión en el contexto.
export async function registrarClienteYConsentir(page: Page, email: string): Promise<void> {
  const numDoc = `${Date.now()}`.slice(-9);
  const registro = await page.request.post("/api/v1/auth/registro", {
    headers: {
      origin: ORIGEN_E2E,
      "x-forwarded-for": `10.7.${Number(numDoc) % 250}.${Number(numDoc) % 200}`,
    },
    data: { tipoDoc: "CC", numDoc, nombre: "Cliente E2E", email },
  });
  expect(registro.status()).toBe(201);

  const envio = await page.request.post("/api/auth/email-otp/send-verification-otp", {
    headers: {
      origin: ORIGEN_E2E,
      "x-forwarded-for": `10.9.${Number(numDoc) % 250}.${Number(numDoc) % 200}`,
    },
    data: { email, type: "sign-in" },
  });
  expect(envio.ok()).toBe(true);

  const otp = await leerOtp(email);
  const ingreso = await page.request.post("/api/auth/sign-in/email-otp", {
    headers: {
      origin: ORIGEN_E2E,
      "x-forwarded-for": `10.8.${Number(numDoc) % 250}.${Number(numDoc) % 200}`,
    },
    data: { email, otp },
  });
  expect(ingreso.ok()).toBe(true);

  const consentimiento = await page.request.post("/api/v1/consentimiento", {
    headers: { origin: ORIGEN_E2E },
  });
  expect(consentimiento.ok()).toBe(true);
}

export function correoE2E(): string {
  return `cliente.${Date.now()}.${Math.floor(Math.random() * 1e6)}@prueba.co`;
}
