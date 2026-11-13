import { eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { condicionesTasa, entidades, staffMembers } from "./schema.ts";

// Semilla idempotente: se puede ejecutar cuantas veces se quiera. Nunca pisa ajustes del
// coordinador (on conflict do nothing) y no siembra festivos (no se inventan fechas).

const ENTIDADES = [
  { id: "ban100", nombre: "Ban100", docKeys: ["ban_vinc", "ban_orden"], plazoEnMeses: false },
  {
    id: "colte",
    nombre: "Coltefinanciera",
    docKeys: ["colte_vinc", "colte_cdt"],
    plazoEnMeses: false,
  },
  { id: "juris", nombre: "Juriscoop", docKeys: ["juris"], plazoEnMeses: true },
  { id: "mmujer", nombre: "Mundo Mujer", docKeys: ["mmujer"], plazoEnMeses: false },
] as const;

// Tasas de demostración: solo para entidades que aún no tienen ninguna condición.
const CONDICIONES_DEMO = [
  { plazoDias: 90, periodicidad: "vencimiento", tasaEa: "9.5000" },
  { plazoDias: 180, periodicidad: "vencimiento", tasaEa: "10.0000" },
  { plazoDias: 180, periodicidad: "mensual", tasaEa: "9.8000" },
  { plazoDias: 360, periodicidad: "vencimiento", tasaEa: "10.5000" },
  { plazoDias: 360, periodicidad: "mensual", tasaEa: "10.3000" },
] as const;

export async function sembrarBase(
  db: Db,
  opciones: { adminEmail: string; demo: boolean },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .insert(entidades)
      .values(
        ENTIDADES.map((e) => ({
          id: e.id,
          nombre: e.nombre,
          docKeys: [...e.docKeys],
          montoMinimo: 0,
          baseCalculo: "calendario",
          ajusteNoHabil: "siguiente_habil",
          plazoEnMeses: e.plazoEnMeses,
        })),
      )
      .onConflictDoNothing();

    await tx
      .insert(staffMembers)
      .values({
        email: opciones.adminEmail.toLowerCase(),
        nombre: "Administración",
        rol: "admin",
      })
      .onConflictDoNothing();

    if (!opciones.demo) {
      return;
    }
    for (const entidad of ENTIDADES) {
      const existentes = await tx
        .select({ id: condicionesTasa.id })
        .from(condicionesTasa)
        .where(eq(condicionesTasa.entidadId, entidad.id))
        .limit(1);
      if (existentes.length > 0) {
        continue;
      }
      await tx.insert(condicionesTasa).values(
        CONDICIONES_DEMO.map((c) => ({
          entidadId: entidad.id,
          plazoDias: c.plazoDias,
          montoMin: 1000000,
          montoMax: null,
          periodicidad: c.periodicidad,
          tasaEa: c.tasaEa,
          vigenteDesde: "2026-01-01",
        })),
      );
    }
  });
}
