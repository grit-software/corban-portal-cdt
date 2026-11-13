import { eq } from "drizzle-orm";
import type { DatosConstitucion } from "@/lib/portafolio/constitucion";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { cdts, solicitudes } from "@/server/db/schema";
import { type FilaSolicitud, ejecutarTransicion } from "@/server/solicitudes/transiciones";

// Constitución (contratos.md §3, acción `constituir`): la solicitud pasa a cdt_constituido y se
// crea exactamente una fila en `cdts`. Todo en la transacción de ejecutarTransicion: si el número
// de CDT ya existe para la entidad, la transacción revierte y no queda nada escrito.

const UNICIDAD_NUMERO = "cdts_entidad_numero_uq";

// Lo que el asesor cambió frente a los valores congelados al aprobar. Va a la auditoría.
type Diferencia = { campo: string; antes: unknown; despues: unknown };

function coinciden(antes: unknown, despues: unknown): boolean {
  if (antes === null || antes === undefined) return despues === null || despues === undefined;
  const a = String(antes);
  const b = String(despues);
  if (a === b) return true;
  // Tasa y valor pueden llegar con distinta escritura ("10.0000" y "10.5"): se comparan como número.
  return !Number.isNaN(Number(a)) && !Number.isNaN(Number(b)) && Number(a) === Number(b);
}

function diferenciasCon(fila: FilaSolicitud, datos: DatosConstitucion): Diferencia[] {
  const pares: [string, unknown, unknown][] = [
    ["valor", fila.valor, datos.valor],
    ["tasaEa", fila.tasaEa, datos.tasaEa],
    ["fechaApertura", fila.fechaApertura, datos.fechaApertura],
    ["fechaVenc", fila.fechaVenc, datos.fechaVenc],
  ];
  return pares
    .filter(([, antes, despues]) => !coinciden(antes, despues))
    .map(([campo, antes, despues]) => ({ campo, antes, despues }));
}

// Error de Postgres envuelto por drizzle: el código y la restricción están en la causa. El
// driver `postgres` nombra la restricción `constraint_name`; otros drivers, `constraint`.
function esViolacionDeNumero(error: unknown): boolean {
  const causa = (error instanceof Error && error.cause ? error.cause : error) as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
  };
  const restriccion = causa.constraint_name ?? causa.constraint;
  return causa.code === "23505" && restriccion === UNICIDAD_NUMERO;
}

export async function constituir(actor: Actor, solicitudId: string, datos: DatosConstitucion) {
  const numeroCdt = datos.numeroCdt.trim();

  return ejecutarTransicion(actor, solicitudId, "constituir", {}, async (tx, fila) => {
    if (!fila.periodicidad) {
      throw new ErrorDominio(
        "SIN_CONDICION",
        "La solicitud no tiene la periodicidad congelada; no se puede constituir",
      );
    }

    let cdt: { id: string } | undefined;
    try {
      [cdt] = await tx
        .insert(cdts)
        .values({
          clienteId: fila.clienteId,
          entidadId: fila.entidadId,
          numeroCdt,
          valor: datos.valor,
          tasaEa: datos.tasaEa,
          fechaApertura: datos.fechaApertura,
          fechaVenc: datos.fechaVenc,
          periodicidad: fila.periodicidad,
          estado: "vigente",
          origen: "solicitud",
          solicitudId: fila.id,
        })
        .returning({ id: cdts.id });
    } catch (error) {
      if (esViolacionDeNumero(error)) {
        throw new ErrorDominio("CONFLICTO", "Ya existe un CDT con ese número en esta entidad", {
          numeroCdt: "Este número ya está registrado",
        });
      }
      throw error;
    }

    // Los valores congelados de la solicitud se conservan; los finales viven en `cdts`.
    await tx
      .update(solicitudes)
      .set({ constituidaAt: new Date() })
      .where(eq(solicitudes.id, fila.id));

    return {
      cdtId: cdt?.id ?? null,
      numeroCdt,
      cambios: diferenciasCon(fila, datos),
    };
  });
}
