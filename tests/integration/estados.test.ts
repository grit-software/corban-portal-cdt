import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { GET as descargaCliente } from "@/app/api/v1/solicitudes/[id]/documentos/[docId]/route";
import { crearStorageFs } from "@/server/almacenamiento/fs";
import { VERSION_CONSENTIMIENTO, getActor } from "@/server/auth/actor";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { cerrarDb, getDb } from "@/server/db/client";
import {
  auditEvents,
  clientes,
  consentimientos,
  documentos,
  solicitudEventos,
  solicitudes,
  solicitudVersiones,
  staffMembers,
  user,
} from "@/server/db/schema";
import { transicionValida, type Accion, ESTADOS } from "@/server/solicitudes/estados";
import { aprobar } from "@/server/solicitudes/aprobacion";
import { devolver } from "@/server/solicitudes/acciones";
import { asegurarEntidades, crearCondicion } from "../helpers/fabricas.ts";
import {
  BASE,
  correoUnico,
  documentoUnico,
  ingresarCliente,
  ipUnica,
} from "../helpers/auth-clientes.ts";

// Máquina de estados (contratos.md §3), aprobación con PDF versionados y descarga.

afterAll(cerrarDb);

// Filas de la tabla de transiciones de §3: [acción, estados de origen, destino]. Escritas aquí.
const FILAS: [Accion, string[]][] = [
  ["enviar", ["borrador", "devuelta"]],
  ["aprobar", ["pendiente_validacion"]],
  ["devolver", ["pendiente_validacion"]],
  ["cargar_firma", ["pendiente_firma"]],
  ["aceptar_firma", ["firma_en_revision"]],
  ["rechazar_firma", ["firma_en_revision"]],
  ["enviar_entidad", ["lista_para_enviar"]],
  ["constituir", ["enviada_entidad"]],
  [
    "cancelar",
    [
      "borrador",
      "devuelta",
      "pendiente_validacion",
      "pendiente_firma",
      "firma_en_revision",
      "lista_para_enviar",
      "enviada_entidad",
    ],
  ],
  [
    "editar_post_aprobacion",
    ["pendiente_firma", "firma_en_revision", "lista_para_enviar", "enviada_entidad"],
  ],
];

describe("tabla de transiciones (contratos.md §3)", () => {
  it("cada fila es válida desde sus estados de origen y cualquier otra combinación no lo es", () => {
    for (const [accion, origenes] of FILAS) {
      for (const estado of ESTADOS) {
        expect(transicionValida(accion, estado), `${accion} desde ${estado}`).toBe(
          origenes.includes(estado),
        );
      }
    }
  });
});

// Asesor con usuario real: las acciones escriben user_id en eventos y versiones (claves foráneas).
async function crearAsesor(): Promise<Actor> {
  const email = correoUnico();
  const userId = randomUUID();
  await getDb().insert(user).values({ id: userId, name: "Asesor de prueba", email });
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Asesor de prueba", rol: "asesor", userId })
    .returning({ id: staffMembers.id });
  return { tipo: "staff", userId, staffId: fila?.id ?? "", rol: "asesor", email };
}

// Datos completos de un cliente y de una solicitud en pendiente_validacion.
async function solicitudEnValidacion(
  asesor: Actor,
  plazo: number,
  fechaApertura: string,
): Promise<{ id: string; clienteId: string }> {
  const email = correoUnico();
  const [cliente] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Cliente de estados",
      origen: "registro",
    })
    .returning({ id: clientes.id });
  const id = randomUUID();
  await getDb()
    .insert(solicitudes)
    .values({
      id,
      clienteId: cliente?.id ?? "",
      asesorId: asesor.tipo === "staff" ? asesor.staffId : null,
      entidadId: "ban100",
      estado: "pendiente_validacion",
      valor: 50_000_000,
      plazoDias: plazo,
      periodicidad: "vencimiento",
      fechaApertura,
      datos: DATOS_FORMULARIO,
    });
  return { id, clienteId: cliente?.id ?? "" };
}

const DATOS_FORMULARIO: Record<string, string> = {
  tipo_cdt: "desmaterializado",
  ciudad: "Medellín",
  oficina: "Poblado",
  fecha_dilig: "2026-03-02",
  forma_pago: "transferencia",
  nombre1: "María",
  nombre2: "Fernanda",
  apellido1: "Gómez",
  apellido2: "Restrepo",
  tipo_doc: "CC",
  num_doc: "43123456",
  email: "maria.gomez@ejemplo.com",
  celular: "3001234567",
  direccion: "Calle 10 # 40-25 Apto 301",
  ciudad_res: "Medellín",
  depto_res: "Antioquia",
  pais_res: "Colombia",
  ingresos: "12000000",
  otros_ingresos: "1500000",
  activos: "480000000",
  pasivos: "120000000",
  declara_renta: "si",
  cta_banco: "Bancolombia",
  cta_tipo: "ahorros",
  cta_numero: "12345678901",
  cta_titular: "María Fernanda Gómez Restrepo",
};

async function clienteConConsentimiento(email: string, clienteId: string): Promise<string> {
  const cookie = await ingresarCliente(email);
  const actor = await getActor(new Headers({ cookie }));
  if (actor?.tipo !== "cliente") throw new Error("sin actor de cliente");
  await getDb().insert(consentimientos).values({
    userId: actor.userId,
    clienteId,
    version: VERSION_CONSENTIMIENTO,
    ip: ipUnica(),
    userAgent: "prueba",
  });
  return cookie;
}

describe("transiciones con base de datos", () => {
  it("devolver sin observación responde MOTIVO_REQUERIDO y conserva el estado", async () => {
    await asegurarEntidades();
    const asesor = await crearAsesor();
    const { id } = await solicitudEnValidacion(asesor, 90, "2099-03-02");

    const error = await devolver(asesor, id, "   ").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDominio);
    expect((error as ErrorDominio).code).toBe("MOTIVO_REQUERIDO");
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("pendiente_validacion");
  });

  it("una combinación fuera de la tabla responde TRANSICION_INVALIDA sin escribir filas", async () => {
    const asesor = await crearAsesor();
    const { id } = await solicitudEnValidacion(asesor, 90, "2099-03-02");
    await getDb().update(solicitudes).set({ estado: "borrador" }).where(eq(solicitudes.id, id));

    const error = await devolver(asesor, id, "Falta el RUT").catch((e: unknown) => e);
    expect((error as ErrorDominio).code).toBe("TRANSICION_INVALIDA");
    const eventos = await getDb()
      .select()
      .from(solicitudEventos)
      .where(eq(solicitudEventos.solicitudId, id));
    expect(eventos).toHaveLength(0);
  });

  it("devolver con observación pasa a devuelta con un evento y una auditoría", async () => {
    const asesor = await crearAsesor();
    const { id } = await solicitudEnValidacion(asesor, 90, "2099-03-02");

    await devolver(asesor, id, "Falta el RUT");

    const [fila] = await getDb()
      .select({ estado: solicitudes.estado, observacion: solicitudes.observacion })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila).toEqual({ estado: "devuelta", observacion: "Falta el RUT" });
    const eventos = await getDb()
      .select()
      .from(solicitudEventos)
      .where(eq(solicitudEventos.solicitudId, id));
    expect(eventos).toHaveLength(1);
    const auditoria = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.accion, "solicitud.devolver"), eq(auditEvents.targetId, id)));
    expect(auditoria).toHaveLength(1);
  });

  it("aprobar copia los valores congelados, crea la versión 1 y guarda un PDF por formato con sha256", async () => {
    await asegurarEntidades();
    const asesor = await crearAsesor();
    const plazo = 40_000 + Math.floor(Math.random() * 500_000);
    await crearCondicion("ban100", {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "10.5000",
      vigenteDesde: "2020-01-01",
    });
    const { id } = await solicitudEnValidacion(asesor, plazo, "2099-03-02");

    await aprobar(asesor, id);

    const [fila] = await getDb().select().from(solicitudes).where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("pendiente_firma");
    expect(fila?.tasaEa).toBe("10.5000");
    expect(fila?.fechaVenc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(fila?.condicionId).not.toBeNull();
    expect(fila?.versionActual).toBe(1);

    const versiones = await getDb()
      .select()
      .from(solicitudVersiones)
      .where(eq(solicitudVersiones.solicitudId, id));
    expect(versiones.map((v) => v.numero)).toEqual([1]);

    const docs = await getDb().select().from(documentos).where(eq(documentos.solicitudId, id));
    expect(docs.map((d) => d.docKey).sort()).toEqual(["ban_orden", "ban_vinc"]);
    for (const doc of docs) {
      expect(doc.version).toBe(1);
      expect(doc.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("aprobar escribe exactamente un evento y una auditoría solicitud.aprobar", async () => {
    await asegurarEntidades();
    const asesor = await crearAsesor();
    const plazo = 40_000 + Math.floor(Math.random() * 500_000);
    await crearCondicion("ban100", {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "9.9000",
      vigenteDesde: "2020-01-01",
    });
    const { id } = await solicitudEnValidacion(asesor, plazo, "2099-03-02");

    await aprobar(asesor, id);

    const eventos = await getDb()
      .select()
      .from(solicitudEventos)
      .where(
        and(eq(solicitudEventos.solicitudId, id), eq(solicitudEventos.hacia, "pendiente_firma")),
      );
    expect(eventos).toHaveLength(1);
    const auditoria = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.accion, "solicitud.aprobar"), eq(auditEvents.targetId, id)));
    expect(auditoria).toHaveLength(1);
  });

  it("el dueño descarga el PDF con el sha256 guardado y otro cliente recibe 404", async () => {
    await asegurarEntidades();
    const asesor = await crearAsesor();
    const plazo = 40_000 + Math.floor(Math.random() * 500_000);
    await crearCondicion("ban100", {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "10.1000",
      vigenteDesde: "2020-01-01",
    });
    const { id, clienteId } = await solicitudEnValidacion(asesor, plazo, "2099-03-02");
    await aprobar(asesor, id);
    const [doc] = await getDb().select().from(documentos).where(eq(documentos.solicitudId, id));

    const emailDueno = correoUnico();
    await getDb().update(clientes).set({ email: emailDueno }).where(eq(clientes.id, clienteId));
    const cookieDueno = await clienteConConsentimiento(emailDueno, clienteId);
    const otro = await (async () => {
      const email = correoUnico();
      const [c] = await getDb()
        .insert(clientes)
        .values({
          tipoDoc: "CC",
          numDoc: documentoUnico(),
          email,
          nombre: "Otro",
          origen: "registro",
        })
        .returning({ id: clientes.id });
      return clienteConConsentimiento(email, c?.id ?? "");
    })();

    const url = `${BASE}/api/v1/solicitudes/${id}/documentos/${doc?.id}`;
    const respuesta = await descargaCliente(
      new Request(url, { headers: { cookie: cookieDueno } }),
      {
        params: Promise.resolve({ id, docId: doc?.id ?? "" }),
      },
    );
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(doc?.sha256);

    const ajena = await descargaCliente(new Request(url, { headers: { cookie: otro } }), {
      params: Promise.resolve({ id, docId: doc?.id ?? "" }),
    });
    expect(ajena.status).toBe(404);
    expect((await ajena.json()).error.code).toBe("NO_ENCONTRADO");
  });
});

describe("almacenamiento fs", () => {
  it("get devuelve los mismos bytes y nada se escribe bajo public/", async () => {
    const raiz = path.resolve(".data/test-storage-estados");
    const almacen = crearStorageFs(raiz);
    const clave = `solicitudes/${randomUUID()}/v1/prueba.pdf`;
    const bytes = new TextEncoder().encode("%PDF-1.4 prueba");

    await almacen.put(clave, bytes);
    expect(await almacen.get(clave)).toEqual(bytes);
    expect(existsSync(path.resolve("public", clave))).toBe(false);
    expect(readFileSync(path.join(raiz, clave))).toEqual(Buffer.from(bytes));
  });

  it("rechaza claves que salen de la raíz", async () => {
    const almacen = crearStorageFs(path.resolve(".data/test-storage-estados"));
    await expect(almacen.put("../fuera.pdf", new Uint8Array([1]))).rejects.toThrow();
  });
});
