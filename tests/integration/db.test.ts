import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { reiniciarEnvParaPruebas } from "@/lib/env";
import { cerrarDb, getDb } from "@/server/db/client";
import { festivos } from "@/server/db/schema";

describe("base de datos (corban_test)", () => {
  afterAll(cerrarDb);

  it("ejecuta select 1 y devuelve una fila", async () => {
    const filas = await getDb().execute(sql`select 1 as uno`);
    expect(filas.length).toBe(1);
  });

  it("inserta y lee un festivo", async () => {
    const db = getDb();
    await db
      .insert(festivos)
      .values({ fecha: "2099-12-31", nombre: "Festivo de prueba" })
      .onConflictDoNothing();
    const [fila] = await db.select().from(festivos).where(sql`${festivos.fecha} = '2099-12-31'`);
    expect(fila?.nombre).toBe("Festivo de prueba");
  });

  it("lanza un error que nombra DATABASE_URL cuando no está definida", async () => {
    const original = process.env.DATABASE_URL;
    Reflect.deleteProperty(process.env, "DATABASE_URL");
    reiniciarEnvParaPruebas();
    try {
      const { getEnv } = await import("@/lib/env");
      expect(() => getEnv()).toThrow(/DATABASE_URL/);
    } finally {
      if (original !== undefined) {
        process.env.DATABASE_URL = original;
      }
      reiniciarEnvParaPruebas();
    }
  });
});
