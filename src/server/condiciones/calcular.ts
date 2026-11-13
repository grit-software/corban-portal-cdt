import { and, asc, eq } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { getDb } from "@/server/db/client";
import { type PERIODICIDADES, condicionesTasa, entidades, festivos } from "@/server/db/schema";
import { calcularCondiciones } from "./motor.ts";

export type EntradaCalculo = {
  entidadId: string;
  valor: number;
  plazoDias: number;
  periodicidad: (typeof PERIODICIDADES)[number];
  fechaApertura: string;
};

// Carga entidad, filas candidatas y festivos desde la base y delega en el motor puro.
// Los errores del motor llegan como ErrorDominio con el mismo código (contratos.md §1).
export async function calcularParaSolicitud(actor: Actor, entrada: EntradaCalculo) {
  if (!can(actor, "condiciones.ver")) {
    throw new ErrorDominio("PROHIBIDO", "No puedes consultar las condiciones");
  }
  const db = getDb();
  const [entidad] = await db
    .select()
    .from(entidades)
    .where(and(eq(entidades.id, entrada.entidadId), eq(entidades.activa, true)))
    .limit(1);
  if (!entidad) {
    throw new ErrorDominio("NO_ENCONTRADO", "La entidad no existe");
  }
  const filas = await db
    .select()
    .from(condicionesTasa)
    .where(
      and(
        eq(condicionesTasa.entidadId, entrada.entidadId),
        eq(condicionesTasa.plazoDias, entrada.plazoDias),
        eq(condicionesTasa.periodicidad, entrada.periodicidad),
      ),
    );
  const diasFestivos = await db
    .select({ fecha: festivos.fecha })
    .from(festivos)
    .orderBy(asc(festivos.fecha));

  const resultado = calcularCondiciones({
    entidad: {
      id: entidad.id,
      montoMinimo: entidad.montoMinimo,
      baseCalculo: entidad.baseCalculo as "calendario" | "comercial_360",
      ajusteNoHabil: entidad.ajusteNoHabil as "siguiente_habil" | "anterior_habil" | "ninguno",
    },
    filas,
    festivos: diasFestivos.map((f) => f.fecha),
    valor: entrada.valor,
    plazoDias: entrada.plazoDias,
    periodicidad: entrada.periodicidad,
    fechaApertura: entrada.fechaApertura,
  });
  if (!resultado.ok) {
    throw new ErrorDominio(resultado.error, mensajeDeMotor(resultado.error));
  }
  return resultado;
}

function mensajeDeMotor(error: "MONTO_MINIMO" | "SIN_CONDICION" | "CONDICION_AMBIGUA"): string {
  if (error === "MONTO_MINIMO") return "El valor está por debajo del monto mínimo de la entidad";
  if (error === "SIN_CONDICION")
    return "No hay una tasa vigente para ese plazo, periodicidad y valor";
  return "Hay más de una tasa que aplica; el coordinador debe corregir las condiciones";
}
