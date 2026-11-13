import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz/actor";
import { cerrarDb, getDb } from "@/server/db/client";
import {
  cdts,
  clientes,
  importCargas,
  importPerfiles,
  staffMembers,
  user,
} from "@/server/db/schema";
import { confirmar, rechazosDe, vistaPrevia } from "@/server/importacion/importar";
import { guardarPerfil } from "@/server/importacion/perfiles";
import { crearEntidad, crearStaff, documentoUnico, correoUnico } from "../helpers/fabricas.ts";

// Importación desde Excel (E3-T2). Cada prueba usa entidad, documentos y números de CDT propios:
// nunca se truncan tablas ni se depende del orden.

afterAll(cerrarDb);

const CABECERAS = [
  "Tipo doc",
  "Documento",
  "Nombres",
  "Correo",
  "Celular",
  "Entidad",
  "Numero CDT",
  "Valor",
  "Tasa",
  "Apertura",
  "Vencimiento",
  "Periodicidad",
  "Ciudad",
];

const MAPEO = {
  "Tipo doc": "cliente.tipo_doc",
  Documento: "cliente.num_doc",
  Nombres: "cliente.nombres",
  Correo: "cliente.email",
  Celular: "cliente.celular",
  Entidad: "cdt.entidad",
  "Numero CDT": "cdt.numero_cdt",
  Valor: "cdt.valor",
  Tasa: "cdt.tasa_ea",
  Apertura: "cdt.fecha_apertura",
  Vencimiento: "cdt.fecha_venc",
  Periodicidad: "cdt.periodicidad",
  Ciudad: "cliente.ciudad",
};

// Coordinador con usuario real: la auditoría escribe user_id (clave foránea).
async function crearCoordinador(): Promise<Actor & { tipo: "staff" }> {
  const email = correoUnico();
  const userId = randomUUID();
  await getDb().insert(user).values({ id: userId, name: "Coordinador de importación", email });
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Coordinador de importación", rol: "coordinador", userId })
    .returning({ id: staffMembers.id });
  return { tipo: "staff", userId, staffId: fila?.id ?? "", rol: "coordinador", email };
}

async function libroCon(filas: (string | number)[][]): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Clientes");
  hoja.addRow(CABECERAS);
  for (const fila of filas) hoja.addRow(fila);
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

// Archivo de prueba: dos filas válidas (una con fecha serial de Excel) y tres con errores:
// fecha inexistente, entidad desconocida y documento vacío.
async function archivoDePrueba(entidadNombre: string) {
  const sufijo = randomUUID().slice(0, 8);
  const docA = documentoUnico();
  const docB = documentoUnico();
  const bytes = await libroCon([
    [
      "CC",
      docA,
      "Ana Gómez",
      `ana.${sufijo}@prueba.co`,
      "3001234567",
      entidadNombre,
      `N-A-${sufijo}`,
      5000000,
      10.5,
      "02/03/2026",
      "02/03/2027",
      "mensual",
      "Medellín",
    ],
    [
      "CC",
      docB,
      "Luis Pérez",
      `luis.${sufijo}@prueba.co`,
      "3007654321",
      entidadNombre,
      `N-B-${sufijo}`,
      "$ 2.500.000",
      "10.25",
      46000,
      46365,
      "vencimiento",
      "Cali",
    ],
    [
      "CC",
      documentoUnico(),
      "Fecha mala",
      `mala.${sufijo}@prueba.co`,
      "",
      entidadNombre,
      `N-C-${sufijo}`,
      1000000,
      9,
      "31/02/2026",
      "02/03/2027",
      "mensual",
      "Bogotá",
    ],
    [
      "CC",
      documentoUnico(),
      "Entidad mala",
      `ent.${sufijo}@prueba.co`,
      "",
      "Banco X",
      `N-D-${sufijo}`,
      1000000,
      9,
      "02/03/2026",
      "02/03/2027",
      "mensual",
      "Bogotá",
    ],
    [
      "CC",
      "",
      "Sin documento",
      `sin.${sufijo}@prueba.co`,
      "",
      entidadNombre,
      `N-E-${sufijo}`,
      1000000,
      9,
      "02/03/2026",
      "02/03/2027",
      "mensual",
      "Bogotá",
    ],
  ]);
  return { bytes, docA, docB, sufijo };
}

describe("importación desde Excel (E3-T2)", () => {
  it("la vista previa devuelve totales y, como máximo 50 filas con errores, sin escribir", async () => {
    const coordinador = await crearCoordinador();
    const entidadId = await crearEntidad({});
    const entidadNombre = `Entidad ${entidadId}`;
    const { bytes } = await archivoDePrueba(entidadNombre);

    const previa = await vistaPrevia(coordinador, bytes, MAPEO);

    expect(previa.totalFilas).toBe(5);
    expect(previa.validas).toBe(2);
    expect(previa.conErrores).toBe(3);
    expect(previa.filas.length).toBeLessThanOrEqual(50);
    const errores = previa.filas.flatMap((f) => f.errores).join(" | ");
    expect(errores).toContain("fecha de apertura inválida");
    expect(errores).toContain("entidad desconocida");
    expect(errores).toContain("documento vacío");
  });

  it("confirmar hace upsert de clientes y cdts, guarda el perfil y registra la carga", async () => {
    const coordinador = await crearCoordinador();
    const entidadId = await crearEntidad({});
    const { bytes, docA, docB, sufijo } = await archivoDePrueba(`Entidad ${entidadId}`);
    const perfil = await guardarPerfil(coordinador, { nombre: `perfil-${sufijo}`, mapeo: MAPEO });

    const resumen = await confirmar(coordinador, {
      bytes,
      nombreArchivo: `clientes-${sufijo}.xlsx`,
      mapeo: MAPEO,
      perfilId: perfil.id,
    });

    expect(resumen).toMatchObject({ creadas: 2, actualizadas: 0, sinCambios: 0, rechazadas: 3 });
    const [clienteA] = await getDb()
      .select()
      .from(clientes)
      .where(and(eq(clientes.tipoDoc, "CC"), eq(clientes.numDoc, docA)));
    expect(clienteA?.perfil).toMatchObject({ ciudad: "Medellín" });
    const [cdtA] = await getDb()
      .select()
      .from(cdts)
      .where(and(eq(cdts.entidadId, entidadId), eq(cdts.numeroCdt, `N-A-${sufijo}`)));
    expect(cdtA).toMatchObject({ origen: "importacion", valor: 5000000, periodicidad: "mensual" });
    const [clienteB] = await getDb()
      .select()
      .from(clientes)
      .where(and(eq(clientes.tipoDoc, "CC"), eq(clientes.numDoc, docB)));
    expect(clienteB).toBeDefined();
    const [carga] = await getDb()
      .select()
      .from(importCargas)
      .where(eq(importCargas.id, resumen.cargaId));
    expect(carga).toMatchObject({ filasCreadas: 2, filasRechazadas: 3 });
  });

  it("importar el mismo archivo otra vez no crea, no actualiza y no cambia valores", async () => {
    const coordinador = await crearCoordinador();
    const entidadId = await crearEntidad({});
    const { bytes, docA, sufijo } = await archivoDePrueba(`Entidad ${entidadId}`);
    const perfil = await guardarPerfil(coordinador, { nombre: `perfil-r-${sufijo}`, mapeo: MAPEO });
    await confirmar(coordinador, {
      bytes,
      nombreArchivo: "a.xlsx",
      mapeo: MAPEO,
      perfilId: perfil.id,
    });

    const antes = await getDb().select().from(clientes).where(eq(clientes.numDoc, docA));
    const cdtsAntes = await getDb().select().from(cdts).where(eq(cdts.entidadId, entidadId));

    const segunda = await confirmar(coordinador, {
      bytes,
      nombreArchivo: "a.xlsx",
      mapeo: MAPEO,
      perfilId: perfil.id,
    });

    expect(segunda).toMatchObject({ creadas: 0, actualizadas: 0, sinCambios: 2 });
    const despues = await getDb().select().from(clientes).where(eq(clientes.numDoc, docA));
    const cdtsDespues = await getDb().select().from(cdts).where(eq(cdts.entidadId, entidadId));
    expect(despues.map((c) => [c.nombre, c.email, c.perfil])).toEqual(
      antes.map((c) => [c.nombre, c.email, c.perfil]),
    );
    expect(cdtsDespues.map((c) => [c.valor, c.tasaEa, c.fechaVenc])).toEqual(
      cdtsAntes.map((c) => [c.valor, c.tasaEa, c.fechaVenc]),
    );
  });

  it("las filas rechazadas quedan en un .xlsx descargable con la columna motivo", async () => {
    const coordinador = await crearCoordinador();
    const entidadId = await crearEntidad({});
    const { bytes, sufijo } = await archivoDePrueba(`Entidad ${entidadId}`);
    const perfil = await guardarPerfil(coordinador, { nombre: `perfil-x-${sufijo}`, mapeo: MAPEO });
    const resumen = await confirmar(coordinador, {
      bytes,
      nombreArchivo: "rechazos.xlsx",
      mapeo: MAPEO,
      perfilId: perfil.id,
    });
    expect(resumen.rechazosDisponibles).toBe(true);

    const descarga = await rechazosDe(coordinador, resumen.cargaId);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(descarga.bytes.slice().buffer as ArrayBuffer);
    const hoja = libro.worksheets[0];
    const encabezados = hoja?.getRow(1).values as unknown[];
    expect(encabezados).toContain("motivo");
    expect(encabezados).toContain("Nombres");
    expect(hoja?.rowCount).toBe(1 + 3);
  });

  it("un asesor no puede previsualizar ni confirmar: PROHIBIDO", async () => {
    const asesor = await crearStaff("asesor");
    const bytes = await libroCon([]);
    await expect(vistaPrevia(asesor, bytes, MAPEO)).rejects.toMatchObject({ code: "PROHIBIDO" });
    await expect(
      confirmar(asesor, { bytes, nombreArchivo: "x.xlsx", mapeo: MAPEO, perfilId: randomUUID() }),
    ).rejects.toMatchObject({ code: "PROHIBIDO" });
  });

  it("el perfil de mapeo guardado queda registrado con su nombre", async () => {
    const coordinador = await crearCoordinador();
    const nombre = `perfil-g-${randomUUID().slice(0, 8)}`;
    const perfil = await guardarPerfil(coordinador, { nombre, mapeo: MAPEO });
    const [fila] = await getDb()
      .select()
      .from(importPerfiles)
      .where(eq(importPerfiles.id, perfil.id));
    expect(fila?.nombre).toBe(nombre);
    expect(fila?.mapeo).toMatchObject({ Documento: "cliente.num_doc" });
  });
});
