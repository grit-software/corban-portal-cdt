import { and, eq } from "drizzle-orm";
import { ESQUEMA_DATOS } from "@/lib/datos/esquemas";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { calcularParaSolicitud } from "@/server/condiciones/calcular";
import { getDb } from "@/server/db/client";
import { solicitudVersiones, solicitudes } from "@/server/db/schema";
import { desactualizarAnteriores, generarVersion } from "./generados.ts";
import { visiblesPara } from "./visibilidad.ts";
import { ejecutarTransicion } from "./transiciones.ts";

// Edición del equipo (contratos.md §3). Siempre con motivo. En borrador, devuelta y pendiente de
// validación cambia los datos sin mover el estado. Después de la aprobación recalcula con la
// tabla vigente, abre la versión N+1 y regenera los documentos.

type Cambio = { campo: string; antes: unknown; despues: unknown };

const EDITABLES_SIN_VERSION = ["borrador", "devuelta", "pendiente_validacion"] as const;
const EDITABLES_CON_VERSION = [
  "pendiente_firma",
  "firma_en_revision",
  "lista_para_enviar",
  "enviada_entidad",
] as const;

// Columnas que espejan los datos del CDT: se actualizan con los cambios de esos campos.
function columnasDe(datos: Record<string, string>) {
  return {
    ...(datos.valor !== undefined ? { valor: Number(datos.valor) } : {}),
    ...(datos.plazo_dias !== undefined ? { plazoDias: Number(datos.plazo_dias) } : {}),
    ...(datos.periodicidad !== undefined
      ? { periodicidad: datos.periodicidad as (typeof solicitudes.$inferInsert)["periodicidad"] }
      : {}),
    ...(datos.fecha_apertura !== undefined ? { fechaApertura: datos.fecha_apertura } : {}),
  };
}

export async function editarConMotivo(
  actor: Actor,
  solicitudId: string,
  entrada: { motivo?: string; cambios: Record<string, unknown> },
) {
  if (actor.tipo !== "staff") {
    throw new ErrorDominio("PROHIBIDO", "Solo el equipo puede editar la solicitud");
  }
  const motivo = entrada.motivo?.trim() ?? "";
  if (motivo.length === 0) {
    throw new ErrorDominio("MOTIVO_REQUERIDO", "Indica el motivo de la edición");
  }
  const validos = ESQUEMA_DATOS.safeParse(entrada.cambios);
  if (!validos.success) {
    const campos: Record<string, string> = {};
    for (const problema of validos.error.issues) {
      campos[problema.path.map(String).join(".") || "datos"] ??= problema.message;
    }
    throw new ErrorDominio("VALIDACION", "Revisa los campos marcados", campos);
  }
  const cambios = validos.data as Record<string, string>;

  const [previa] = await getDb()
    .select()
    .from(solicitudes)
    .where(and(eq(solicitudes.id, solicitudId), visiblesPara(actor)))
    .limit(1);
  if (!previa || !can(actor, "solicitud.editar", { asesorId: previa.asesorId })) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
  }

  const diferencias: Cambio[] = Object.entries(cambios)
    .filter(([campo, despues]) => (previa.datos[campo] ?? "") !== despues)
    .map(([campo, despues]) => ({ campo, antes: previa.datos[campo] ?? "", despues }));
  if (diferencias.length === 0) {
    throw new ErrorDominio("VALIDACION", "No hay cambios que guardar");
  }
  const datosNuevos = { ...previa.datos, ...cambios };

  if ((EDITABLES_SIN_VERSION as readonly string[]).includes(previa.estado)) {
    return conAuditoria(
      {
        accion: "solicitud.editar",
        actorId: actor.userId,
        targetType: "solicitud",
        targetId: solicitudId,
        metadata: { motivo, cambios: diferencias },
      },
      async (tx) => {
        const [actual] = await tx
          .select({ estado: solicitudes.estado })
          .from(solicitudes)
          .where(eq(solicitudes.id, solicitudId))
          .for("update");
        if (!actual || !(EDITABLES_SIN_VERSION as readonly string[]).includes(actual.estado)) {
          throw new ErrorDominio(
            "TRANSICION_INVALIDA",
            "La solicitud cambió de estado; revisa de nuevo",
          );
        }
        await tx
          .update(solicitudes)
          .set({ datos: datosNuevos, ...columnasDe(cambios) })
          .where(eq(solicitudes.id, solicitudId));
      },
    );
  }

  if (!(EDITABLES_CON_VERSION as readonly string[]).includes(previa.estado)) {
    throw new ErrorDominio("TRANSICION_INVALIDA", "Esta solicitud ya no se puede editar");
  }
  if (
    !previa.fechaApertura ||
    previa.valor === null ||
    previa.plazoDias === null ||
    previa.periodicidad === null
  ) {
    throw new ErrorDominio("VALIDACION", "La solicitud no tiene los datos del CDT completos");
  }

  return ejecutarTransicion(
    actor,
    solicitudId,
    "editar_post_aprobacion",
    { nota: motivo, metadata: { motivo, cambios: diferencias } },
    async (tx, fila) => {
      const valor = cambios.valor !== undefined ? Number(cambios.valor) : (fila.valor as number);
      const plazoDias =
        cambios.plazo_dias !== undefined ? Number(cambios.plazo_dias) : (fila.plazoDias as number);
      const periodicidad = (cambios.periodicidad ??
        fila.periodicidad) as (typeof solicitudes.$inferInsert)["periodicidad"];
      const fechaApertura = cambios.fecha_apertura ?? (fila.fechaApertura as string);

      // Recalcula con la tabla vigente hoy: la tasa y el vencimiento se congelan de nuevo.
      const calculo = await calcularParaSolicitud(actor, {
        entidadId: fila.entidadId,
        valor,
        plazoDias,
        periodicidad: periodicidad as NonNullable<typeof periodicidad>,
        fechaApertura,
      });
      const version = fila.versionActual + 1;
      const congelado = {
        valor,
        plazoDias,
        periodicidad: periodicidad as string,
        tasaEa: calculo.tasaEa,
        fechaApertura,
        fechaVenc: calculo.fechaVenc,
      };

      await tx
        .update(solicitudes)
        .set({
          datos: datosNuevos,
          ...columnasDe(cambios),
          tasaEa: calculo.tasaEa,
          fechaVenc: calculo.fechaVenc,
          condicionId: calculo.condicionId,
          versionActual: version,
        })
        .where(eq(solicitudes.id, solicitudId));

      await tx.insert(solicitudVersiones).values({
        solicitudId,
        numero: version,
        datos: datosNuevos,
        condiciones: {
          ...congelado,
          condicionId: calculo.condicionId,
          plazoMeses: calculo.plazoMeses,
        },
        motivo,
        creadoPor: actor.userId,
      });

      await desactualizarAnteriores(tx, solicitudId, version);
      await generarVersion(tx, {
        solicitudId,
        entidadId: fila.entidadId,
        datos: datosNuevos,
        congelado,
        version,
        actorUserId: actor.userId,
      });
    },
  );
}
