import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { cerrarDb, getDb } from "@/server/db/client";
import { auditEvents, condicionesTasa, festivos } from "@/server/db/schema";
import { calcularParaSolicitud } from "@/server/condiciones/calcular";
import type { DatosCondicion } from "@/server/condiciones/esquemas";
import { opcionesPara } from "@/server/condiciones/opciones";
import {
  crearCondicion,
  crearFestivo,
  editarCondicion,
  listarCondiciones,
} from "@/server/condiciones/repositorio";
import {
  asegurarEntidades,
  crearCondicion as condicionDirecta,
  crearEntidad,
  crearStaff,
} from "../helpers/fabricas.ts";

// Captura el código de error de un servicio para asertar sin depender del mensaje.
async function codigoDe(promesa: Promise<unknown>): Promise<string | undefined> {
  try {
    await promesa;
    return undefined;
  } catch (error) {
    return error instanceof ErrorDominio ? error.code : "OTRO";
  }
}

async function filasDeCondiciones(entidadId: string): Promise<number> {
  const filas = await getDb()
    .select({ id: condicionesTasa.id })
    .from(condicionesTasa)
    .where(eq(condicionesTasa.entidadId, entidadId));
  return filas.length;
}

function datosBase(entidadId: string, extra: Partial<DatosCondicion> = {}): DatosCondicion {
  return {
    entidadId,
    plazoDias: 90,
    montoMin: 1_000_000,
    montoMax: null,
    periodicidad: "vencimiento",
    tasaEa: "10.0000",
    vigenteDesde: "2020-01-01",
    vigenteHasta: null,
    ...extra,
  };
}

describe("condiciones de tasa, festivos y permisos", () => {
  afterAll(cerrarDb);

  it("un asesor no crea condiciones (PROHIBIDO) y no escribe filas", async () => {
    await asegurarEntidades();
    const entidadId = await crearEntidad({});
    const asesor: Actor = await crearStaff("asesor");
    const antes = await filasDeCondiciones(entidadId);

    const codigo = await codigoDe(crearCondicion(asesor, datosBase(entidadId)));
    expect(codigo).toBe("PROHIBIDO");
    expect(await filasDeCondiciones(entidadId)).toBe(antes);
  });

  it("el coordinador crea la condición y queda una fila de auditoría", async () => {
    const entidadId = await crearEntidad({});
    const coordinador = await crearStaff("coordinador");

    const { id } = await crearCondicion(coordinador, datosBase(entidadId));

    expect(await filasDeCondiciones(entidadId)).toBe(1);
    const auditoria = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.accion, "condicion.crear"), eq(auditEvents.targetId, id)));
    expect(auditoria).toHaveLength(1);
  });

  it("una condición que se cruza con otra (monto y vigencia) responde CONDICION_SOLAPADA", async () => {
    const entidadId = await crearEntidad({});
    const coordinador = await crearStaff("coordinador");
    await crearCondicion(
      coordinador,
      datosBase(entidadId, { montoMax: 10_000_000, vigenteHasta: "2030-12-31" }),
    );
    const antes = await filasDeCondiciones(entidadId);

    const codigo = await codigoDe(
      crearCondicion(
        coordinador,
        datosBase(entidadId, {
          montoMin: 5_000_000,
          montoMax: 20_000_000,
          vigenteDesde: "2025-01-01",
        }),
      ),
    );
    expect(codigo).toBe("CONDICION_SOLAPADA");
    expect(await filasDeCondiciones(entidadId)).toBe(antes);
  });

  it("rangos de monto disjuntos no se consideran solape", async () => {
    const entidadId = await crearEntidad({});
    const coordinador = await crearStaff("coordinador");
    await crearCondicion(coordinador, datosBase(entidadId, { montoMax: 10_000_000 }));

    const codigo = await codigoDe(
      crearCondicion(coordinador, datosBase(entidadId, { montoMin: 10_000_001 })),
    );
    expect(codigo).toBeUndefined();
  });

  it("el coordinador edita una condición y la auditoría guarda el diff de la tasa", async () => {
    const entidadId = await crearEntidad({});
    const coordinador = await crearStaff("coordinador");
    const { id } = await crearCondicion(coordinador, datosBase(entidadId));

    await editarCondicion(coordinador, id, datosBase(entidadId, { tasaEa: "11.2500" }));

    const [auditoria] = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.accion, "condicion.editar"), eq(auditEvents.targetId, id)));
    const metadata = auditoria?.metadata as
      | { cambios: { campo: string; antes: string; despues: string }[] }
      | undefined;
    expect(metadata?.cambios).toEqual([{ campo: "tasaEa", antes: "10.0000", despues: "11.2500" }]);
  });

  it("un asesor no crea festivos y el coordinador sí, con auditoría", async () => {
    const asesor = await crearStaff("asesor");
    const coordinador = await crearStaff("coordinador");
    const fecha = `2099-${String(1 + Math.floor(Math.random() * 12)).padStart(2, "0")}-${String(1 + Math.floor(Math.random() * 28)).padStart(2, "0")}`;

    expect(await codigoDe(crearFestivo(asesor, { fecha, nombre: "Prueba" }))).toBe("PROHIBIDO");
    const fila = await getDb().select().from(festivos).where(eq(festivos.fecha, fecha));
    expect(fila).toHaveLength(0);

    const otraFecha = `2098-${fecha.slice(5)}`;
    await crearFestivo(coordinador, { fecha: otraFecha, nombre: "Festivo de prueba" });
    const creado = await getDb().select().from(festivos).where(eq(festivos.fecha, otraFecha));
    expect(creado).toHaveLength(1);
    const auditoria = await getDb()
      .select()
      .from(auditEvents)
      .where(and(eq(auditEvents.accion, "festivo.crear"), eq(auditEvents.targetId, otraFecha)));
    expect(auditoria.length).toBeGreaterThan(0);
  });

  it("opcionesPara solo devuelve plazos con condición vigente hoy", async () => {
    const entidadId = await crearEntidad({});
    const coordinador = await crearStaff("coordinador");
    const asesor = await crearStaff("asesor");
    await crearCondicion(coordinador, datosBase(entidadId, { plazoDias: 60, tasaEa: "9.1000" }));
    await crearCondicion(
      coordinador,
      datosBase(entidadId, {
        plazoDias: 120,
        vigenteDesde: "2019-01-01",
        vigenteHasta: "2019-12-31",
      }),
    );

    const opciones = await opcionesPara(asesor, entidadId, 5_000_000);
    expect(opciones).toEqual([{ plazoDias: 60, periodicidad: "vencimiento", tasaEa: "9.1000" }]);
  });
});

describe("calcularParaSolicitud: errores del motor", () => {
  it("valor por debajo del monto mínimo responde MONTO_MINIMO", async () => {
    const entidadId = await crearEntidad({ montoMinimo: 5_000_000 });
    const asesor = await crearStaff("asesor");
    const codigo = await codigoDe(
      calcularParaSolicitud(asesor, {
        entidadId,
        valor: 1_000_000,
        plazoDias: 90,
        periodicidad: "vencimiento",
        fechaApertura: "2026-03-02",
      }),
    );
    expect(codigo).toBe("MONTO_MINIMO");
  });

  it("sin condición aplicable responde SIN_CONDICION", async () => {
    const entidadId = await crearEntidad({});
    const asesor = await crearStaff("asesor");
    const codigo = await codigoDe(
      calcularParaSolicitud(asesor, {
        entidadId,
        valor: 5_000_000,
        plazoDias: 90,
        periodicidad: "vencimiento",
        fechaApertura: "2026-03-02",
      }),
    );
    expect(codigo).toBe("SIN_CONDICION");
  });

  it("dos condiciones que aplican responden CONDICION_AMBIGUA", async () => {
    const entidadId = await crearEntidad({});
    const plazo = 50_000 + Math.floor(Math.random() * 100_000);
    await condicionDirecta(entidadId, { plazoDias: plazo, tasaEa: "9.0000" });
    await condicionDirecta(entidadId, { plazoDias: plazo, tasaEa: "9.5000" });
    const asesor = await crearStaff("asesor");
    const codigo = await codigoDe(
      calcularParaSolicitud(asesor, {
        entidadId,
        valor: 5_000_000,
        plazoDias: plazo,
        periodicidad: "vencimiento",
        fechaApertura: "2026-03-02",
      }),
    );
    expect(codigo).toBe("CONDICION_AMBIGUA");
  });

  it("con una condición vigente calcula el vencimiento y la tasa", async () => {
    const entidadId = await crearEntidad({ baseCalculo: "calendario", ajusteNoHabil: "ninguno" });
    // La entidad es nueva en esta prueba: el plazo 90 no choca con otras condiciones.
    const { id } = await condicionDirecta(entidadId, { plazoDias: 90, tasaEa: "10.5000" });
    const asesor = await crearStaff("asesor");

    const resultado = await calcularParaSolicitud(asesor, {
      entidadId,
      valor: 50_000_000,
      plazoDias: 90,
      periodicidad: "vencimiento",
      fechaApertura: "2026-03-02",
    });
    expect(resultado.condicionId).toBe(id);
    expect(resultado.tasaEa).toBe("10.5000");
    // Calendario sin ajuste: 2026-03-02 + 90 días = 2026-05-31 (contratos.md §4, caso 1).
    expect(resultado.fechaVenc).toBe("2026-05-31");
  });
});

describe("lectura de condiciones", () => {
  it("el asesor puede listar condiciones", async () => {
    const asesor = await crearStaff("asesor");
    await expect(listarCondiciones(asesor)).resolves.toBeInstanceOf(Array);
  });
});
