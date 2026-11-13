import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz/actor";
import { cerrarDb, getDb } from "@/server/db/client";
import { cdts, clientes, solicitudes } from "@/server/db/schema";
import { exportarXlsx } from "@/server/reportes/exportar";
import {
  hoyBogota,
  inversion,
  resumenSolicitudes,
  sumarDias,
  vencimientos,
} from "@/server/reportes/consultas";
import { crearEntidad, crearStaff, correoUnico, documentoUnico } from "../helpers/fabricas.ts";

// Reportes de gerencia (E3-T3). Cada prueba crea su entidad, su asesor, sus clientes y sus CDT:
// nunca se truncan tablas y los filtros siempre van por entidad propia.

afterAll(cerrarDb);

const DIAS_CERCA = 15; // dentro de 30
const DIAS_MEDIO = 45; // dentro de 60, fuera de 30
const DIAS_LEJOS = 80; // dentro de 90, fuera de 60
const DIAS_MUY_LEJOS = 200; // vigente, fuera de cualquier ventana

// Cliente con su asesor y CDT vigentes en fechas relativas a hoy (America/Bogota), más uno vencido.
async function sembrarCartera(asesorStaffId: string, entidadId: string) {
  const hoy = hoyBogota();
  const [cliente] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email: correoUnico(),
      nombre: "Cliente de reportes",
      asesorId: asesorStaffId,
      origen: "importacion",
    })
    .returning({ id: clientes.id });
  const clienteId = cliente?.id ?? "";
  const casos: [string, number][] = [
    [sumarDias(hoy, DIAS_CERCA), 1_000_000],
    [sumarDias(hoy, DIAS_MEDIO), 2_000_000],
    [sumarDias(hoy, DIAS_LEJOS), 3_000_000],
    [sumarDias(hoy, DIAS_MUY_LEJOS), 9_000_000],
    [sumarDias(hoy, -5), 500_000], // ya vencido: no es vigente
  ];
  const numeros: string[] = [];
  for (const [fechaVenc, valor] of casos) {
    const numeroCdt = `R-${randomUUID().slice(0, 8)}`;
    numeros.push(numeroCdt);
    await getDb()
      .insert(cdts)
      .values({
        clienteId,
        entidadId,
        numeroCdt,
        valor,
        tasaEa: "10.5000",
        fechaApertura: sumarDias(hoy, -30),
        fechaVenc,
        periodicidad: "mensual",
        estado: "vigente",
        origen: "importacion",
      });
  }
  return { clienteId, numeros };
}

describe("reportes de gerencia (E3-T3)", () => {
  it("la inversión por entidad y por asesor es igual a la suma SQL de los CDT vigentes", async () => {
    const coordinador = await crearStaff("coordinador");
    const asesor = await crearStaff("asesor");
    const entidadId = await crearEntidad({});
    await sembrarCartera(asesor.staffId, entidadId);

    const reporte = await inversion(coordinador, { entidadId });

    const [suma] = await getDb()
      .select({ total: sql<string>`sum(${cdts.valor})` })
      .from(cdts)
      .where(
        and(
          eq(cdts.entidadId, entidadId),
          eq(cdts.estado, "vigente"),
          gte(cdts.fechaVenc, hoyBogota()),
        ),
      );
    const esperado = Number(suma?.total);
    // Cuatro CDT vigentes (el vencido se excluye): 1 + 2 + 3 + 9 millones.
    expect(esperado).toBe(15_000_000);
    expect(reporte.porEntidad.reduce((acc, e) => acc + e.total, 0)).toBe(esperado);
    expect(reporte.porAsesor.reduce((acc, a) => acc + a.total, 0)).toBe(esperado);
  });

  it("los vencimientos listan solo vigentes dentro de cada ventana, en orden ascendente", async () => {
    const coordinador = await crearStaff("coordinador");
    const asesor = await crearStaff("asesor");
    const entidadId = await crearEntidad({});
    const { numeros } = await sembrarCartera(asesor.staffId, entidadId);
    const [cerca, medio, lejos] = numeros;

    const treinta = (await vencimientos(coordinador, 30, { entidadId })).map((f) => f.numeroCdt);
    const sesenta = await vencimientos(coordinador, 60, { entidadId });
    const noventa = await vencimientos(coordinador, 90, { entidadId });

    expect(treinta).toEqual([cerca]);
    expect(sesenta.map((f) => f.numeroCdt)).toEqual([cerca, medio]);
    expect(noventa.map((f) => f.numeroCdt)).toEqual([cerca, medio, lejos]);
    const fechas = noventa.map((f) => f.vencimiento);
    expect([...fechas].sort()).toEqual(fechas);
  });

  it("el resumen de solicitudes cuenta por estado y promedia los días hasta la constitución", async () => {
    const coordinador = await crearStaff("coordinador");
    const asesor = await crearStaff("asesor");
    const entidadId = await crearEntidad({});
    const { clienteId } = await sembrarCartera(asesor.staffId, entidadId);

    const creada = new Date(Date.now() - 10 * 86_400_000);
    const constituida = new Date(creada.getTime() + 10 * 86_400_000);
    const base = {
      clienteId,
      asesorId: asesor.staffId,
      entidadId,
      valor: 50_000_000,
      tasaEa: "10.2500",
      periodicidad: "mensual" as const,
      fechaApertura: sumarDias(hoyBogota(), 1),
      fechaVenc: sumarDias(hoyBogota(), 181),
      datos: {},
    };
    await getDb()
      .insert(solicitudes)
      .values([
        {
          ...base,
          id: randomUUID(),
          estado: "cdt_constituido",
          createdAt: creada,
          constituidaAt: constituida,
        },
        {
          ...base,
          id: randomUUID(),
          estado: "cdt_constituido",
          createdAt: creada,
          constituidaAt: constituida,
        },
        { ...base, id: randomUUID(), estado: "borrador" },
      ]);

    const resumen = await resumenSolicitudes(coordinador, { entidadId });

    expect(resumen.porEstado).toEqual(
      expect.arrayContaining([
        { estado: "borrador", cantidad: 1 },
        { estado: "cdt_constituido", cantidad: 2 },
      ]),
    );
    expect(resumen.constituidas).toBe(2);
    expect(resumen.promedioDias).toBeCloseTo(10, 5);
  });

  it("la exportación .xlsx se puede releer: encabezados en español y las filas del reporte", async () => {
    const coordinador = await crearStaff("coordinador");
    const asesor = await crearStaff("asesor");
    const entidadId = await crearEntidad({});
    await sembrarCartera(asesor.staffId, entidadId);

    const bytes = await exportarXlsx(coordinador, "inversion", { entidadId });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(bytes.slice().buffer as ArrayBuffer);
    const hoja = libro.worksheets[0];
    const encabezados = hoja?.getRow(1).values as unknown[];
    expect(encabezados).toEqual(
      expect.arrayContaining(["Entidad", "Asesor", "Total invertido (COP)"]),
    );
    const reporte = await inversion(coordinador, { entidadId });
    expect(hoja?.rowCount).toBe(1 + reporte.detalle.length);
  });

  it("un cliente o un asesor recibe PROHIBIDO en los tres reportes", async () => {
    const asesor = await crearStaff("asesor");
    const cliente: Actor = {
      tipo: "cliente",
      userId: `usr-${randomUUID()}`,
      clienteId: randomUUID(),
      email: correoUnico(),
      consentimiento: true,
    };

    await expect(inversion(asesor)).rejects.toMatchObject({ code: "PROHIBIDO" });
    await expect(vencimientos(cliente, 30)).rejects.toMatchObject({ code: "PROHIBIDO" });
    await expect(resumenSolicitudes(asesor)).rejects.toMatchObject({ code: "PROHIBIDO" });
    await expect(exportarXlsx(asesor, "solicitudes")).rejects.toMatchObject({ code: "PROHIBIDO" });
  });
});
