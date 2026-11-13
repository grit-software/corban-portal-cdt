import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { EmailClient } from "@azure/communication-email";
import nodemailer from "nodemailer";
import { getEnv } from "@/lib/env";

// Punto único de envío. MAIL_DRIVER elige: file (pruebas y desarrollo), smtp o acs (Azure).
export type Mensaje = { para: string; asunto: string; html: string; texto: string };

export function getMailDriver(): "file" | "smtp" | "acs" {
  return getEnv().MAIL_DRIVER;
}

export async function enviar(mensaje: Mensaje): Promise<void> {
  const env = getEnv();
  switch (env.MAIL_DRIVER) {
    case "file":
      return enviarArchivo(env.MAIL_FILE_DIR, mensaje);
    case "smtp":
      return enviarSmtp(env.SMTP_HOST, env.SMTP_PORT, env.MAIL_FROM, mensaje);
    case "acs":
      return enviarAcs(env.ACS_CONNECTION_STRING ?? "", env.MAIL_FROM, mensaje);
  }
}

// Driver file: un JSON por correo, que leen las pruebas. Nombre: <Date.now()>-<8 hex>-<para>.json
async function enviarArchivo(directorio: string, mensaje: Mensaje): Promise<void> {
  await mkdir(directorio, { recursive: true });
  const para = mensaje.para.replace(/[^a-z0-9@._-]/gi, "_");
  const nombre = `${Date.now()}-${randomBytes(4).toString("hex")}-${para}.json`;
  await writeFile(path.join(directorio, nombre), JSON.stringify(mensaje, null, 2), "utf8");
}

async function enviarSmtp(
  host: string,
  puerto: number,
  remitente: string,
  mensaje: Mensaje,
): Promise<void> {
  const transporte = nodemailer.createTransport({ host, port: puerto, secure: false });
  await transporte.sendMail({
    from: remitente,
    to: mensaje.para,
    subject: mensaje.asunto,
    html: mensaje.html,
    text: mensaje.texto,
  });
}

async function enviarAcs(conexion: string, remitente: string, mensaje: Mensaje): Promise<void> {
  const cliente = new EmailClient(conexion);
  const poller = await cliente.beginSend({
    senderAddress: extraerDireccion(remitente),
    content: { subject: mensaje.asunto, html: mensaje.html, plainText: mensaje.texto },
    recipients: { to: [{ address: mensaje.para }] },
  });
  await poller.pollUntilDone();
}

// "Corban FC <no-responder@corbanfc.com>" → "no-responder@corbanfc.com"
function extraerDireccion(remitente: string): string {
  const coincidencia = /<([^>]+)>/.exec(remitente);
  return coincidencia?.[1] ?? remitente;
}
