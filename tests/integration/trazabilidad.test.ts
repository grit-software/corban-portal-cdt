import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/logger";
import { cerrarDb, getDb } from "@/server/db/client";
import { auditEvents, entidades } from "@/server/db/schema";
import { conAuditoria } from "@/server/auditoria/conAuditoria";

describe("conAuditoria()", () => {
  afterAll(cerrarDb);

  it("deja exactamente una fila de auditoría con los datos del evento", async () => {
    const accion = `prueba.exito.${randomUUID()}`;
    const entidadId = `prueba-${randomUUID()}`;
    const targetId = randomUUID();

    await conAuditoria(
      {
        accion,
        actorId: "usr-prueba",
        targetType: "entidad",
        targetId,
        metadata: { cambios: [{ campo: "nombre", antes: "a", despues: "b" }] },
      },
      async (tx) => {
        await tx.insert(entidades).values({ id: entidadId, nombre: "Prueba", docKeys: ["p"] });
        return entidadId;
      },
    );

    const filas = await getDb().select().from(auditEvents).where(eq(auditEvents.accion, accion));
    expect(filas).toHaveLength(1);
    const [fila] = filas;
    expect(fila?.actorId).toBe("usr-prueba");
    expect(fila?.targetType).toBe("entidad");
    expect(fila?.targetId).toBe(targetId);
    expect(fila?.metadata).toEqual({ cambios: [{ campo: "nombre", antes: "a", despues: "b" }] });
  });

  it("si la mutación lanza, revierte la mutación y la fila de auditoría", async () => {
    const accion = `prueba.fallo.${randomUUID()}`;
    const entidadId = `prueba-${randomUUID()}`;

    await expect(
      conAuditoria(
        { accion, actorId: null, targetType: "entidad", targetId: entidadId },
        async (tx) => {
          await tx.insert(entidades).values({ id: entidadId, nombre: "Revertida", docKeys: ["p"] });
          throw new Error("fallo deliberado");
        },
      ),
    ).rejects.toThrow("fallo deliberado");

    const entidad = await getDb().select().from(entidades).where(eq(entidades.id, entidadId));
    expect(entidad).toHaveLength(0);
    const auditoria = await getDb()
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.accion, accion));
    expect(auditoria).toHaveLength(0);
  });
});

describe("log: redacción de datos personales", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reemplaza num_doc, email, celular y cta_numero por [REDACTADO] en cualquier nivel", () => {
    const lineas: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((fragmento: string | Uint8Array) => {
      lineas.push(String(fragmento));
      return true;
    });

    log.info("prueba de redacción", {
      num_doc: "43123456",
      email: "persona@ejemplo.com",
      celular: "3001234567",
      cta_numero: "12345678901",
      anidado: {
        nivel: { email: "otra@ejemplo.com" },
        lista: [{ celular: "3109876543" }],
      },
      publico: "visible",
    });

    expect(lineas).toHaveLength(1);
    const registro = JSON.parse(lineas[0] ?? "{}") as {
      datos: Record<string, unknown>;
    };
    const texto = lineas[0] ?? "";
    expect(registro.datos.num_doc).toBe("[REDACTADO]");
    expect(registro.datos.email).toBe("[REDACTADO]");
    expect(registro.datos.celular).toBe("[REDACTADO]");
    expect(registro.datos.cta_numero).toBe("[REDACTADO]");
    expect(registro.datos.publico).toBe("visible");
    expect(texto).not.toContain("43123456");
    expect(texto).not.toContain("persona@ejemplo.com");
    expect(texto).not.toContain("otra@ejemplo.com");
    expect(texto).not.toContain("3109876543");
  });
});
