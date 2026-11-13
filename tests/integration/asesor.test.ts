import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Actor } from "@/server/authz/actor";
import type { ErrorDominio } from "@/server/authz/errores";
import { cerrarDb, getDb } from "@/server/db/client";
import {
  auditEvents,
  clientes,
  documentos,
  solicitudes,
  solicitudVersiones,
  staffMembers,
  user,
} from "@/server/db/schema";
import { bandeja, detalleStaff, listado, POR_PAGINA } from "@/server/solicitudes/consultas";
import { editarConMotivo } from "@/server/solicitudes/edicion";
import { reasignarCliente } from "@/server/solicitudes/reasignacion";
import { obtenerSolicitud } from "@/server/solicitudes/servicio";
import { asegurarEntidades, crearCondicion } from "../helpers/fabricas.ts";
import { correoUnico, documentoUnico } from "../helpers/auth-clientes.ts";

// Espacio de trabajo del asesor (E2-T7): bandeja, listado, edición con motivo, reasignación y
// alerta de vigencia. Todo a nivel de servicio, con usuarios reales.

beforeAll(asegurarEntidades);
afterAll(cerrarDb);

const fixture = JSON.parse(
  readFileSync(path.resolve("tests/fixtures/cliente-ejemplo.json"), "utf8"),
) as {
  datos: Record<string, string>;
};

async function staffReal(rol: "asesor" | "coordinador"): Promise<Actor & { tipo: "staff" }> {
  const email = correoUnico();
  const userId = randomUUID();
  await getDb()
    .insert(user)
    .values({ id: userId, name: `Equipo ${rol}`, email });
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: `Equipo ${rol}`, rol, userId })
    .returning({ id: staffMembers.id });
  return { tipo: "staff", userId, staffId: fila?.id ?? "", rol, email };
}

async function clienteNuevo(nombre = "Cliente asesor"): Promise<string> {
  const [fila] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email: correoUnico(),
      nombre,
      origen: "registro",
    })
    .returning({ id: clientes.id });
  return fila?.id ?? "";
}

async function solicitud(
  clienteId: string,
  asesorId: string | null,
  estado: (typeof solicitudes.$inferInsert)["estado"],
  extra: Partial<typeof solicitudes.$inferInsert> = {},
): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(solicitudes)
    .values({
      id,
      clienteId,
      asesorId,
      entidadId: "ban100",
      estado,
      datos: {},
      ...extra,
    });
  return id;
}

describe("bandeja y listado", () => {
  it("la bandeja lista primero validación y firma en revisión", async () => {
    const asesor = await staffReal("asesor");
    const cliente = await clienteNuevo();
    await solicitud(cliente, asesor.staffId, "borrador");
    await solicitud(cliente, asesor.staffId, "pendiente_validacion");
    await solicitud(cliente, asesor.staffId, "firma_en_revision");
    await solicitud(cliente, asesor.staffId, "cancelada");

    const { filas } = await bandeja(asesor);
    expect(
      filas
        .slice(0, 2)
        .map((f) => f.estado)
        .sort(),
    ).toEqual(["firma_en_revision", "pendiente_validacion"]);
  });

  it("el listado pagina de a 25: con 60 solicitudes salen páginas de 25, 25 y 10", async () => {
    expect(POR_PAGINA).toBe(25);
    const asesor = await staffReal("asesor");
    const cliente = await clienteNuevo("Paginado");
    for (let i = 0; i < 60; i++) {
      await solicitud(cliente, asesor.staffId, "borrador");
    }
    const paginas = [];
    for (const pagina of [1, 2, 3]) {
      paginas.push((await listado(asesor, { pagina })).filas.length);
    }
    expect(paginas).toEqual([25, 25, 10]);
    expect((await listado(asesor, { pagina: 1 })).total).toBe(60);
  });

  it("q busca por nombre y documento y devuelve solo las coincidencias", async () => {
    const asesor = await staffReal("asesor");
    const marca = `Marca${randomUUID().slice(0, 8)}`;
    const clienteConMarca = await clienteNuevo(`Juan ${marca}`);
    const clienteSinMarca = await clienteNuevo("Otra persona");
    const soloNombre = await solicitud(clienteConMarca, asesor.staffId, "borrador");
    await solicitud(clienteSinMarca, asesor.staffId, "borrador");

    const { filas, total } = await listado(asesor, { q: marca });
    expect(total).toBe(1);
    expect(filas[0]?.id).toBe(soloNombre);
  });
});

describe("edición del equipo", () => {
  it("sin motivo responde MOTIVO_REQUERIDO y no cambia nada", async () => {
    const asesor = await staffReal("asesor");
    const id = await solicitud(await clienteNuevo(), asesor.staffId, "pendiente_validacion", {
      datos: { ciudad: "Medellín" },
    });

    const error = await editarConMotivo(asesor, id, { cambios: { ciudad: "Bogotá" } }).catch(
      (e: unknown) => e,
    );
    expect((error as ErrorDominio).code).toBe("MOTIVO_REQUERIDO");
    const [fila] = await getDb()
      .select({ datos: solicitudes.datos })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.datos.ciudad).toBe("Medellín");
  });

  it("en firma_en_revision abre la versión N+1, regenera PDF, desactualiza el firmado y registra los diffs", async () => {
    const asesor = await staffReal("asesor");
    const plazo = 60_000 + Math.floor(Math.random() * 500_000);
    await crearCondicion("ban100", {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "10.5000",
      vigenteDesde: "2020-01-01",
    });
    const id = await solicitud(await clienteNuevo(), asesor.staffId, "firma_en_revision", {
      datos: fixture.datos,
      valor: 50_000_000,
      plazoDias: plazo,
      periodicidad: "vencimiento",
      fechaApertura: "2099-03-02",
      versionActual: 1,
    });
    await getDb()
      .insert(documentos)
      .values({
        solicitudId: id,
        version: 1,
        tipo: "firmado",
        storagePath: `solicitudes/${id}/v1/firmado.pdf`,
        nombreArchivo: "firmado.pdf",
        sha256: "2".repeat(64),
        bytes: 1,
        estado: "vigente",
      });

    await editarConMotivo(asesor, id, {
      motivo: "Corrección de ciudad",
      cambios: { ciudad: "Bogotá" },
    });

    const versiones = await getDb()
      .select()
      .from(solicitudVersiones)
      .where(eq(solicitudVersiones.solicitudId, id));
    expect(versiones.map((v) => v.numero)).toEqual([2]);
    const [firmado] = await getDb()
      .select()
      .from(documentos)
      .where(and(eq(documentos.solicitudId, id), eq(documentos.tipo, "firmado")));
    expect(firmado?.estado).toBe("desactualizado");
    const nuevos = await getDb()
      .select()
      .from(documentos)
      .where(
        and(
          eq(documentos.solicitudId, id),
          eq(documentos.version, 2),
          eq(documentos.tipo, "generado"),
        ),
      );
    expect(nuevos.length).toBeGreaterThan(0);
    const [fila] = await getDb()
      .select({ estado: solicitudes.estado, version: solicitudes.versionActual })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila).toEqual({ estado: "pendiente_firma", version: 2 });

    const [auditoria] = await getDb()
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.accion, "solicitud.editar_post_aprobacion"),
          eq(auditEvents.targetId, id),
        ),
      );
    const cambios = (auditoria?.metadata as { cambios: unknown[] } | undefined)?.cambios;
    expect(cambios).toEqual([{ campo: "ciudad", antes: "Medellín", despues: "Bogotá" }]);
  });
});

describe("reasignación", () => {
  it("el coordinador reasigna; el asesor anterior ya no ve la solicitud; el asesor no puede reasignar", async () => {
    const coordinador = await staffReal("coordinador");
    const anterior = await staffReal("asesor");
    const nuevo = await staffReal("asesor");
    const cliente = await clienteNuevo();
    const id = await solicitud(cliente, anterior.staffId, "borrador");

    await expect(reasignarCliente(anterior, cliente, nuevo.staffId)).rejects.toMatchObject({
      code: "PROHIBIDO",
    });

    await reasignarCliente(coordinador, cliente, nuevo.staffId);
    const [fila] = await getDb()
      .select({ asesorId: solicitudes.asesorId })
      .from(solicitudes)
      .where(eq(solicitudes.id, id));
    expect(fila?.asesorId).toBe(nuevo.staffId);
    await expect(obtenerSolicitud(anterior, id)).rejects.toMatchObject({ code: "NO_ENCONTRADO" });
  });
});

describe("alerta de vigencia", () => {
  it("con la condición congelada vencida devuelve alertaVigencia true", async () => {
    const asesor = await staffReal("asesor");
    const plazo = 70_000 + Math.floor(Math.random() * 500_000);
    const { id: condicionId } = await crearCondicion("ban100", {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "10.0000",
      vigenteDesde: "2020-01-01",
      vigenteHasta: "2021-12-31",
    });
    const id = await solicitud(await clienteNuevo(), asesor.staffId, "pendiente_firma", {
      condicionId,
    });

    const detalle = await detalleStaff(asesor, id);
    expect(detalle.alertaVigencia).toBe(true);
  });

  it("con la condición vigente no hay alerta", async () => {
    const asesor = await staffReal("asesor");
    const plazo = 80_000 + Math.floor(Math.random() * 500_000);
    const { id: condicionId } = await crearCondicion("ban100", {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "10.0000",
      vigenteDesde: "2020-01-01",
    });
    const id = await solicitud(await clienteNuevo(), asesor.staffId, "pendiente_firma", {
      condicionId,
    });
    expect((await detalleStaff(asesor, id)).alertaVigencia).toBe(false);
  });
});
