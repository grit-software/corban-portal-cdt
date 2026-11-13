import { randomUUID } from "node:crypto";
import { eq, getTableName, is, sql } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, describe, expect, it } from "vitest";
import { cerrarDb, getDb } from "@/server/db/client";
import * as schema from "@/server/db/schema";
import { auditEvents, clientes, entidades, solicitudes } from "@/server/db/schema";

// Código SQLSTATE de un error de Postgres envuelto por drizzle (ver .claude/rules/pruebas.md).
function codigoDeError(error: unknown): string | undefined {
  const envuelto = error as { cause?: { code?: string }; code?: string };
  return (envuelto.cause ?? envuelto).code;
}

async function capturarError(consulta: Promise<unknown>): Promise<unknown> {
  return consulta.then(
    () => undefined,
    (error: unknown) => error,
  );
}

describe("esquema", () => {
  afterAll(cerrarDb);

  it("cada tabla exportada por schema.ts existe en la base", async () => {
    const db = getDb();
    const nombresExportados = Object.values(schema)
      .filter((valor) => is(valor, PgTable))
      .map((tabla) => getTableName(tabla as PgTable));
    expect(nombresExportados.length).toBeGreaterThan(0);

    const filas = (await db.execute(
      sql`select table_name from information_schema.tables where table_schema = 'public'`,
    )) as unknown as { table_name: string }[];
    const existentes = new Set(filas.map((f) => f.table_name));

    for (const nombre of nombresExportados) {
      expect(existentes.has(nombre), `falta la tabla ${nombre}`).toBe(true);
    }
  });

  it("audit_events rechaza UPDATE, DELETE y TRUNCATE con SQLSTATE 42501 y no cambia la fila", async () => {
    const db = getDb();
    const [fila] = await db
      .insert(auditEvents)
      .values({
        accion: "prueba.insertar",
        targetType: "prueba",
        targetId: randomUUID(),
      })
      .returning({ id: auditEvents.id });
    expect(fila).toBeDefined();
    const id = fila?.id ?? 0;

    const intentos = [
      sql`update audit_events set accion = 'alterada' where id = ${id}`,
      sql`delete from audit_events where id = ${id}`,
      sql`truncate audit_events`,
    ];
    for (const intento of intentos) {
      const error = await capturarError(db.execute(intento));
      expect(error, "la operación debía fallar").toBeDefined();
      expect(codigoDeError(error)).toBe("42501");
    }

    const [despues] = await db.select().from(auditEvents).where(eq(auditEvents.id, id));
    expect(despues?.accion).toBe("prueba.insertar");
  });

  it("clientes rechaza un segundo registro con el mismo tipo y número de documento (23505)", async () => {
    const db = getDb();
    const numDoc = randomUUID();
    await db.insert(clientes).values({
      tipoDoc: "CC",
      numDoc,
      email: `${randomUUID()}@prueba.co`,
      nombre: "Cliente de prueba",
    });

    const error = await capturarError(
      db.insert(clientes).values({
        tipoDoc: "CC",
        numDoc,
        email: `${randomUUID()}@prueba.co`,
        nombre: "Cliente duplicado",
      }),
    );
    expect(codigoDeError(error)).toBe("23505");
  });

  it("una solicitud sin codigo recibe uno con formato SOL-000000", async () => {
    const db = getDb();
    const entidadId = `prueba-${randomUUID()}`;
    await db.insert(entidades).values({
      id: entidadId,
      nombre: "Entidad de prueba",
      docKeys: ["prueba"],
    });
    const [cliente] = await db
      .insert(clientes)
      .values({
        tipoDoc: "CC",
        numDoc: randomUUID(),
        email: `${randomUUID()}@prueba.co`,
        nombre: "Cliente de prueba",
      })
      .returning({ id: clientes.id });

    const [solicitud] = await db
      .insert(solicitudes)
      .values({ clienteId: cliente?.id ?? "", entidadId })
      .returning({ codigo: solicitudes.codigo });

    expect(solicitud?.codigo).toMatch(/^SOL-\d{6}$/);
  });
});
