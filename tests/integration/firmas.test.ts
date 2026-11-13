import { randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import { and, eq } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { POST as firmadosPost } from "@/app/api/v1/solicitudes/[id]/firmados/route";
import { POST as revisionPost } from "@/app/api/staff/solicitudes/[id]/firma/[accion]/route";
import { getStorage } from "@/server/almacenamiento/storage";
import { VERSION_CONSENTIMIENTO, getActor } from "@/server/auth/actor";
import { cerrarDb, getDb } from "@/server/db/client";
import type { Estado } from "@/server/solicitudes/estados";
import { clientes, consentimientos, documentos, solicitudes } from "@/server/db/schema";
import { asegurarEntidades, sesionStaff } from "../helpers/fabricas.ts";
import {
  BASE,
  correoUnico,
  documentoUnico,
  ingresarCliente,
  ipUnica,
} from "../helpers/auth-clientes.ts";

// Carga y revisión de la firma (E2-T6): tipos por bytes, límites, PDF unido y revisión.

beforeAll(asegurarEntidades);
afterAll(cerrarDb);

// PNG válido de un color, generado en la prueba (sin binarios en el repositorio).
function png(ancho: number, alto: number): Uint8Array {
  const fila = Buffer.alloc(1 + ancho * 3); // filtro 0 + RGB por píxel
  for (let x = 0; x < ancho; x++) {
    fila[1 + x * 3] = 200;
    fila[2 + x * 3] = 60;
    fila[3 + x * 3] = 60;
  }
  const bruto = Buffer.concat(Array.from({ length: alto }, () => fila));
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // profundidad
  cabecera[9] = 2; // RGB
  const fragmento = (tipo: string, datos: Buffer) => {
    const longitud = Buffer.alloc(4);
    longitud.writeUInt32BE(datos.length);
    const tipoBuf = Buffer.from(tipo, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([tipoBuf, datos])));
    return Buffer.concat([longitud, tipoBuf, datos, crc]);
  };
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      fragmento("IHDR", cabecera),
      fragmento("IDAT", deflateSync(bruto)),
      fragmento("IEND", Buffer.alloc(0)),
    ]),
  );
}

async function clienteConConsentimiento(): Promise<{ cookie: string; clienteId: string }> {
  const email = correoUnico();
  const [cliente] = await getDb()
    .insert(clientes)
    .values({ tipoDoc: "CC", numDoc: documentoUnico(), email, nombre: "Firma", origen: "registro" })
    .returning({ id: clientes.id });
  const cookie = await ingresarCliente(email);
  const actor = await getActor(new Headers({ cookie }));
  if (actor?.tipo !== "cliente") throw new Error("sin actor de cliente");
  await getDb()
    .insert(consentimientos)
    .values({
      userId: actor.userId,
      clienteId: cliente?.id ?? "",
      version: VERSION_CONSENTIMIENTO,
      ip: ipUnica(),
      userAgent: "prueba",
    });
  return { cookie, clienteId: cliente?.id ?? "" };
}

async function solicitudEn(
  estado: Estado,
  clienteId: string,
  asesorId: string | null,
): Promise<string> {
  const id = randomUUID();
  await getDb().insert(solicitudes).values({
    id,
    clienteId,
    asesorId,
    entidadId: "ban100",
    estado,
    versionActual: 1,
    valor: 50_000_000,
    plazoDias: 90,
    periodicidad: "vencimiento",
    fechaApertura: "2099-03-02",
    datos: {},
  });
  return id;
}

function formulario(archivos: { nombre: string; tipo: string; bytes: Uint8Array }[]): FormData {
  const datos = new FormData();
  for (const a of archivos) {
    datos.append("archivos", new File([a.bytes as BlobPart], a.nombre, { type: a.tipo }));
  }
  return datos;
}

function subida(id: string, cookie: string, datos: FormData): Request {
  return new Request(`${BASE}/api/v1/solicitudes/${id}/firmados`, {
    method: "POST",
    headers: { cookie, origin: new URL(BASE).origin },
    body: datos,
  });
}

async function documentosFirmados(id: string) {
  return getDb()
    .select()
    .from(documentos)
    .where(and(eq(documentos.solicitudId, id), eq(documentos.tipo, "firmado")));
}

describe("carga del firmado (cliente)", () => {
  it("criterio 1: dos PNG forman un PDF de 2 páginas A4 y la solicitud pasa a firma_en_revision", async () => {
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn("pendiente_firma", cliente.clienteId, null);

    const respuesta = await firmadosPost(
      subida(
        id,
        cliente.cookie,
        formulario([
          { nombre: "frente.png", tipo: "image/png", bytes: png(120, 80) },
          { nombre: "reverso.png", tipo: "image/png", bytes: png(120, 80) },
        ]),
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(respuesta.status).toBe(200);
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("firma_en_revision");

    const [doc] = await documentosFirmados(id);
    expect(doc?.version).toBe(1);
    const bytes = await getStorage().get(doc?.storagePath ?? "");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    const { width, height } = pdf.getPage(0).getSize();
    expect(width).toBeCloseTo(595.28, 1);
    expect(height).toBeCloseTo(841.89, 1);
  });

  it("criterio 2: un archivo que no es PDF, JPEG ni PNG responde 415 y no guarda nada", async () => {
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn("pendiente_firma", cliente.clienteId, null);

    const respuesta = await firmadosPost(
      subida(
        id,
        cliente.cookie,
        formulario([
          { nombre: "falso.png", tipo: "image/png", bytes: new TextEncoder().encode("no soy png") },
        ]),
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(respuesta.status).toBe(415);
    expect((await respuesta.json()).error.code).toBe("TIPO_NO_PERMITIDO");
    expect(await documentosFirmados(id)).toHaveLength(0);
  });

  it("criterio 3: más de 10 archivos responde 413 CARGA_DEMASIADO_GRANDE", async () => {
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn("pendiente_firma", cliente.clienteId, null);
    const once = Array.from({ length: 11 }, (_, i) => ({
      nombre: `p${i}.png`,
      tipo: "image/png",
      bytes: png(10, 10),
    }));

    const respuesta = await firmadosPost(subida(id, cliente.cookie, formulario(once)), {
      params: Promise.resolve({ id }),
    });
    expect(respuesta.status).toBe(413);
    expect((await respuesta.json()).error.code).toBe("CARGA_DEMASIADO_GRANDE");
  });

  it("criterio 3: más de 15 MB en total responde 413 antes de guardar", async () => {
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn("pendiente_firma", cliente.clienteId, null);
    const grande = new Uint8Array(16 * 1024 * 1024);
    grande.set(new TextEncoder().encode("%PDF-1.4"));

    const respuesta = await firmadosPost(
      subida(
        id,
        cliente.cookie,
        formulario([{ nombre: "grande.pdf", tipo: "application/pdf", bytes: grande }]),
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(respuesta.status).toBe(413);
    expect(await documentosFirmados(id)).toHaveLength(0);
  });
});

describe("revisión de la firma (asesor)", () => {
  it("criterio 4: aceptar marca el firmado como aceptado y pasa a lista_para_enviar", async () => {
    const asesor = await sesionStaff("asesor");
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn(
      "firma_en_revision",
      cliente.clienteId,
      asesor.actor.tipo === "staff" ? asesor.actor.staffId : null,
    );
    await getDb()
      .insert(documentos)
      .values({
        solicitudId: id,
        version: 1,
        tipo: "firmado",
        storagePath: `solicitudes/${id}/v1/prueba.pdf`,
        nombreArchivo: "prueba.pdf",
        sha256: "0".repeat(64),
        bytes: 1,
        estado: "vigente",
      });

    const respuesta = await revisionPost(
      new Request(`${BASE}/api/staff/solicitudes/${id}/firma/aceptar`, {
        method: "POST",
        headers: {
          cookie: asesor.cookie,
          origin: new URL(BASE).origin,
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ id, accion: "aceptar" }) },
    );
    expect(respuesta.status).toBe(200);
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("lista_para_enviar");
    const [doc] = await documentosFirmados(id);
    expect(doc?.estado).toBe("aceptado");
  });

  it("criterio 4: rechazar con motivo marca rechazado con motivo_rechazo y vuelve a pendiente_firma", async () => {
    const asesor = await sesionStaff("asesor");
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn(
      "firma_en_revision",
      cliente.clienteId,
      asesor.actor.tipo === "staff" ? asesor.actor.staffId : null,
    );
    await getDb()
      .insert(documentos)
      .values({
        solicitudId: id,
        version: 1,
        tipo: "firmado",
        storagePath: `solicitudes/${id}/v1/rechazo.pdf`,
        nombreArchivo: "rechazo.pdf",
        sha256: "1".repeat(64),
        bytes: 1,
        estado: "vigente",
      });

    const respuesta = await revisionPost(
      new Request(`${BASE}/api/staff/solicitudes/${id}/firma/rechazar`, {
        method: "POST",
        headers: {
          cookie: asesor.cookie,
          origin: new URL(BASE).origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({ motivo: "La firma no es legible" }),
      }),
      { params: Promise.resolve({ id, accion: "rechazar" }) },
    );
    expect(respuesta.status).toBe(200);
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("pendiente_firma");
    const [doc] = await documentosFirmados(id);
    expect(doc).toMatchObject({ estado: "rechazado", motivoRechazo: "La firma no es legible" });
  });

  it("criterio 5: rechazar sin motivo responde 422 MOTIVO_REQUERIDO y conserva el estado", async () => {
    const asesor = await sesionStaff("asesor");
    const cliente = await clienteConConsentimiento();
    const id = await solicitudEn(
      "firma_en_revision",
      cliente.clienteId,
      asesor.actor.tipo === "staff" ? asesor.actor.staffId : null,
    );

    const respuesta = await revisionPost(
      new Request(`${BASE}/api/staff/solicitudes/${id}/firma/rechazar`, {
        method: "POST",
        headers: {
          cookie: asesor.cookie,
          origin: new URL(BASE).origin,
          "content-type": "application/json",
        },
        body: "{}",
      }),
      { params: Promise.resolve({ id, accion: "rechazar" }) },
    );
    expect(respuesta.status).toBe(422);
    expect((await respuesta.json()).error.code).toBe("MOTIVO_REQUERIDO");
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("firma_en_revision");
  });
});
