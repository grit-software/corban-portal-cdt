import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { GET as portafolioApi } from "@/app/api/v1/portafolio/route";
import { VERSION_CONSENTIMIENTO, getActor } from "@/server/auth/actor";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { cerrarDb, getDb } from "@/server/db/client";
import {
  auditEvents,
  cdts,
  clientes,
  consentimientos,
  solicitudes,
  staffMembers,
  user,
} from "@/server/db/schema";
import { cancelar } from "@/server/solicitudes/acciones";
import { constituir } from "@/server/portafolio/constituir";
import { portafolioDe } from "@/server/portafolio/consultas";
import { crearEntidad, crearStaff } from "../helpers/fabricas.ts";
import { correoUnico, documentoUnico, ingresarCliente, ipUnica } from "../helpers/auth-clientes.ts";

// Envío, constitución y portafolio (E3-T1). Cada prueba crea sus filas con claves únicas: una
// entidad propia, números de CDT aleatorios y clientes nuevos. Nunca se truncan tablas.

afterAll(cerrarDb);

const FECHA_APERTURA = "2099-01-02";
const FECHA_VENC = "2099-07-02";

// Asesor con usuario real: las acciones escriben user_id en eventos (clave foránea).
async function crearAsesor(): Promise<Actor & { tipo: "staff" }> {
  const email = correoUnico();
  const userId = randomUUID();
  await getDb().insert(user).values({ id: userId, name: "Asesor de portafolio", email });
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Asesor de portafolio", rol: "asesor", userId })
    .returning({ id: staffMembers.id });
  return { tipo: "staff", userId, staffId: fila?.id ?? "", rol: "asesor", email };
}

async function crearClienteFila(): Promise<{ id: string; email: string }> {
  const email = correoUnico();
  const [fila] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Cliente de portafolio",
      origen: "registro",
    })
    .returning({ id: clientes.id });
  return { id: fila?.id ?? "", email };
}

// Solicitud asignada al asesor, en el estado indicado, con su condición congelada.
async function solicitudEn(
  asesor: Actor,
  entidadId: string,
  estado: "enviada_entidad" | "cdt_constituido",
): Promise<{ id: string; clienteId: string }> {
  const cliente = await crearClienteFila();
  const id = randomUUID();
  await getDb()
    .insert(solicitudes)
    .values({
      id,
      clienteId: cliente.id,
      asesorId: asesor.tipo === "staff" ? asesor.staffId : null,
      entidadId,
      estado,
      valor: 50_000_000,
      tasaEa: "10.2500",
      periodicidad: "mensual",
      fechaApertura: FECHA_APERTURA,
      fechaVenc: FECHA_VENC,
      datos: {},
    });
  return { id, clienteId: cliente.id };
}

function datosConstitucion(numeroCdt: string, valor = 50_000_000) {
  return {
    numeroCdt,
    valor,
    tasaEa: "10.5000",
    fechaApertura: FECHA_APERTURA,
    fechaVenc: FECHA_VENC,
  };
}

function codigoDe(error: unknown): string | undefined {
  return error instanceof ErrorDominio ? error.code : undefined;
}

describe("constitución (E3-T1)", () => {
  it("constituir pasa a cdt_constituido, fija constituida_at y crea exactamente una fila de origen solicitud", async () => {
    const entidadId = await crearEntidad({});
    const asesor = await crearAsesor();
    const { id } = await solicitudEn(asesor, entidadId, "enviada_entidad");
    const numeroCdt = `CDT-${randomUUID()}`;

    await constituir(asesor, id, datosConstitucion(numeroCdt));

    const [solicitud] = await getDb().select().from(solicitudes).where(eq(solicitudes.id, id));
    expect(solicitud?.estado).toBe("cdt_constituido");
    expect(solicitud?.constituidaAt).toBeInstanceOf(Date);

    const filas = await getDb().select().from(cdts).where(eq(cdts.solicitudId, id));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      origen: "solicitud",
      numeroCdt,
      estado: "vigente",
      periodicidad: "mensual",
      entidadId,
      clienteId: solicitud?.clienteId,
    });
    expect(filas[0]?.valor).toBe(50_000_000);
  });

  it("constituir registra en la auditoría las diferencias frente a los valores congelados", async () => {
    const entidadId = await crearEntidad({});
    const asesor = await crearAsesor();
    const { id } = await solicitudEn(asesor, entidadId, "enviada_entidad");

    await constituir(asesor, id, datosConstitucion(`CDT-${randomUUID()}`, 51_000_000));

    const [evento] = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.targetId, id), eq(auditEvents.accion, "solicitud.constituir")));
    // Valor cambió (50 → 51 millones) y la tasa también: frente a 10.2500 se guardó 10.5000.
    const cambios = (evento?.metadata as { cambios?: { campo: string }[] } | undefined)?.cambios;
    expect(cambios?.map((c) => c.campo)).toEqual(["valor", "tasaEa"]);
  });

  it("un número de CDT repetido para la entidad responde CONFLICTO, deja una sola fila y la solicitud en enviada_entidad", async () => {
    const entidadId = await crearEntidad({});
    const asesor = await crearAsesor();
    const primera = await solicitudEn(asesor, entidadId, "enviada_entidad");
    const segunda = await solicitudEn(asesor, entidadId, "enviada_entidad");
    const numeroCdt = `CDT-${randomUUID()}`;
    await constituir(asesor, primera.id, datosConstitucion(numeroCdt));

    const error = await constituir(asesor, segunda.id, datosConstitucion(numeroCdt)).catch(
      (e: unknown) => e,
    );

    expect(codigoDe(error)).toBe("CONFLICTO");
    const filas = await getDb().select().from(cdts).where(eq(cdts.numeroCdt, numeroCdt));
    expect(filas.filter((f) => f.entidadId === entidadId)).toHaveLength(1);
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado, constituidaAt: solicitudes.constituidaAt })
      .from(solicitudes)
      .where(eq(solicitudes.id, segunda.id));
    expect(fila?.estado).toBe("enviada_entidad");
    expect(fila?.constituidaAt).toBeNull();
  });

  it("cancelar una solicitud en cdt_constituido responde TRANSICION_INVALIDA", async () => {
    const entidadId = await crearEntidad({});
    const asesor = await crearAsesor();
    const { id } = await solicitudEn(asesor, entidadId, "enviada_entidad");
    await constituir(asesor, id, datosConstitucion(`CDT-${randomUUID()}`));

    const error = await cancelar(asesor, id, "Cambio de opinión").catch((e: unknown) => e);

    expect(codigoDe(error)).toBe("TRANSICION_INVALIDA");
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.estado).toBe("cdt_constituido");
  });
});

// Cliente con consentimiento vigente y CDT de prueba. Devuelve su cookie para la API y su correo.
async function clienteConCdts(
  filas: { numeroCdt: string; valor: number; tasaEa: string; fechaVenc: string }[],
): Promise<{ clienteId: string; cookie: string; email: string }> {
  const cliente = await crearClienteFila();
  const cookie = await ingresarCliente(cliente.email);
  const actor = await getActor(new Headers({ cookie }));
  if (actor?.tipo !== "cliente") throw new Error("sin actor de cliente");
  await getDb().insert(consentimientos).values({
    userId: actor.userId,
    clienteId: cliente.id,
    version: VERSION_CONSENTIMIENTO,
    ip: ipUnica(),
    userAgent: "prueba",
  });
  const entidadId = await crearEntidad({});
  for (const fila of filas) {
    await getDb().insert(cdts).values({
      clienteId: cliente.id,
      entidadId,
      numeroCdt: fila.numeroCdt,
      valor: fila.valor,
      tasaEa: fila.tasaEa,
      fechaApertura: "2020-01-02",
      fechaVenc: fila.fechaVenc,
      periodicidad: "vencimiento",
      estado: "vigente",
      origen: "importacion",
    });
  }
  return { clienteId: cliente.id, cookie, email: cliente.email };
}

describe("portafolio (E3-T1)", () => {
  it("GET /api/v1/portafolio devuelve solo los CDT vigentes del dueño, con total y vencimientos ascendentes", async () => {
    await clienteConCdts([
      {
        numeroCdt: `OTRO-${randomUUID()}`,
        valor: 900_000_000,
        tasaEa: "9.0000",
        fechaVenc: "2099-02-01",
      },
    ]);
    const { cookie } = await clienteConCdts([
      { numeroCdt: "V-TARDE", valor: 3_000_000, tasaEa: "10.0000", fechaVenc: "2099-09-30" },
      { numeroCdt: "V-PRONTO", valor: 1_000_000, tasaEa: "10.0000", fechaVenc: "2099-01-15" },
      { numeroCdt: "V-MEDIO", valor: 2_000_000, tasaEa: "10.0000", fechaVenc: "2099-05-20" },
    ]);

    const respuesta = await portafolioApi(
      new Request("http://localhost:3000/api/v1/portafolio", { headers: { cookie } }),
    );

    expect(respuesta.status).toBe(200);
    const { data } = (await respuesta.json()) as {
      data: {
        vigentes: { numeroCdt: string; valor: number }[];
        totalInvertido: number;
        proximosVencimientos: { numeroCdt: string; fechaVenc: string }[];
      };
    };
    const numeros = data.vigentes.map((c) => c.numeroCdt);
    expect(numeros).toEqual(expect.arrayContaining(["V-TARDE", "V-PRONTO", "V-MEDIO"]));
    expect(numeros.some((n) => n.startsWith("OTRO-"))).toBe(false);
    const suma = data.vigentes.reduce((total, c) => total + c.valor, 0);
    expect(data.totalInvertido).toBe(suma);
    const fechas = data.proximosVencimientos.map((c) => c.fechaVenc);
    expect(fechas).toEqual([...fechas].sort());
    expect(data.proximosVencimientos[0]?.numeroCdt).toBe("V-PRONTO");
  });

  it("un CDT con fecha de vencimiento anterior a hoy se excluye aunque su estado sea vigente", async () => {
    const { cookie } = await clienteConCdts([
      {
        numeroCdt: "VENCIDO-VIGENTE",
        valor: 4_000_000,
        tasaEa: "10.0000",
        fechaVenc: "2001-03-01",
      },
      { numeroCdt: "AL-DIA", valor: 5_000_000, tasaEa: "10.0000", fechaVenc: "2099-03-01" },
    ]);
    const actor = await getActor(new Headers({ cookie }));
    if (actor?.tipo !== "cliente") throw new Error("sin actor de cliente");

    const portafolio = await portafolioDe(actor);

    const numeros = portafolio.vigentes.map((c) => c.numeroCdt);
    expect(numeros).toContain("AL-DIA");
    expect(numeros).not.toContain("VENCIDO-VIGENTE");
    expect(portafolio.totalInvertido).toBe(5_000_000);
  });

  it("un asesor que no tiene asignado al cliente no ve su portafolio: NO_ENCONTRADO", async () => {
    const asesorAjeno = await crearAsesor();
    const asesorDueno = await crearAsesor();
    const entidadId = await crearEntidad({});
    const { clienteId } = await solicitudEn(asesorDueno, entidadId, "cdt_constituido");

    const error = await portafolioDe(asesorAjeno, clienteId).catch((e: unknown) => e);

    expect(codigoDe(error)).toBe("NO_ENCONTRADO");
  });

  it("un coordinador ve el portafolio de un cliente concreto", async () => {
    const coordinador = await crearStaff("coordinador");
    const asesor = await crearAsesor();
    const entidadId = await crearEntidad({});
    const { id, clienteId } = await solicitudEn(asesor, entidadId, "enviada_entidad");
    await constituir(asesor, id, datosConstitucion(`CDT-${randomUUID()}`));

    const portafolio = await portafolioDe(coordinador, clienteId);

    expect(portafolio.vigentes).toHaveLength(1);
    expect(portafolio.totalInvertido).toBe(50_000_000);
  });
});
