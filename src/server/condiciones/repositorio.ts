import { randomUUID } from "node:crypto";
import { and, asc, eq, ne } from "drizzle-orm";
import type { Actor, ActorStaff } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { condicionesTasa, entidades, festivos, staffMembers } from "@/server/db/schema";
import type { DatosCondicion, DatosFestivo } from "./esquemas.ts";

// Repositorio de condiciones de tasa y festivos. Escrituras con permiso, validación de solapes
// y auditoría en la misma transacción (CLAUDE.md: "nadie digita tasa ni vencimiento" — aquí se
// guardan las tablas que el coordinador administra; el cálculo lo hace el motor).

const FIN_DEL_TIEMPO = "9999-12-31";

// Asegura el permiso y deja al actor narrowed a staff (las escrituras necesitan su staffId).
function exigirPermiso(actor: Actor, accion: string): asserts actor is ActorStaff {
  if (actor.tipo !== "staff" || !can(actor, accion)) {
    throw new ErrorDominio("PROHIBIDO", "No tienes permiso para administrar esto");
  }
}

// Dos condiciones de la misma entidad, plazo y periodicidad se solapan si se cruzan en monto
// Y en vigencia. Un monto máximo nulo o una vigencia sin fin cuentan como infinito.
export function seSolapan(
  a: {
    montoMin: number;
    montoMax: number | null;
    vigenteDesde: string;
    vigenteHasta: string | null;
  },
  b: {
    montoMin: number;
    montoMax: number | null;
    vigenteDesde: string;
    vigenteHasta: string | null;
  },
): boolean {
  const montoSeCruza =
    a.montoMin <= (b.montoMax ?? Number.POSITIVE_INFINITY) &&
    b.montoMin <= (a.montoMax ?? Number.POSITIVE_INFINITY);
  const vigenciaSeCruza =
    a.vigenteDesde <= (b.vigenteHasta ?? FIN_DEL_TIEMPO) &&
    b.vigenteDesde <= (a.vigenteHasta ?? FIN_DEL_TIEMPO);
  return montoSeCruza && vigenciaSeCruza;
}

export async function listarCondiciones(actor: Actor) {
  exigirPermiso(actor, "condiciones.ver");
  return getDb()
    .select()
    .from(condicionesTasa)
    .orderBy(asc(condicionesTasa.entidadId), asc(condicionesTasa.plazoDias));
}

export async function listarFestivos(actor: Actor) {
  exigirPermiso(actor, "condiciones.ver");
  return getDb().select().from(festivos).orderBy(asc(festivos.fecha));
}

export async function listarEntidades(actor: Actor) {
  exigirPermiso(actor, "condiciones.ver");
  return getDb().select().from(entidades).orderBy(asc(entidades.nombre));
}

// Valida solapes dentro de la transacción, con la entidad bloqueada para que dos escrituras
// simultáneas no se crucen entre sí.
async function validarSinSolape(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  datos: DatosCondicion,
  excluirId?: string,
): Promise<void> {
  const [entidad] = await tx
    .select({ id: entidades.id })
    .from(entidades)
    .where(eq(entidades.id, datos.entidadId))
    .for("update");
  if (!entidad) {
    throw new ErrorDominio("NO_ENCONTRADO", "La entidad no existe");
  }
  const existentes = await tx
    .select()
    .from(condicionesTasa)
    .where(
      and(
        eq(condicionesTasa.entidadId, datos.entidadId),
        eq(condicionesTasa.plazoDias, datos.plazoDias),
        eq(condicionesTasa.periodicidad, datos.periodicidad),
        excluirId ? ne(condicionesTasa.id, excluirId) : undefined,
      ),
    );
  const choca = existentes.some((otra) => seSolapan(datos, otra));
  if (choca) {
    throw new ErrorDominio(
      "CONDICION_SOLAPADA",
      "Ya existe una condición con ese plazo, periodicidad, rango de monto y vigencia",
    );
  }
}

export async function crearCondicion(actor: Actor, datos: DatosCondicion): Promise<{ id: string }> {
  exigirPermiso(actor, "condiciones.administrar");
  const id = randomUUID();
  await conAuditoria(
    {
      accion: "condicion.crear",
      actorId: actor.userId,
      targetType: "condicion",
      targetId: id,
      metadata: {
        entidadId: datos.entidadId,
        plazoDias: datos.plazoDias,
        periodicidad: datos.periodicidad,
      },
    },
    async (tx) => {
      await validarSinSolape(tx, datos);
      await tx.insert(condicionesTasa).values({
        id,
        entidadId: datos.entidadId,
        plazoDias: datos.plazoDias,
        montoMin: datos.montoMin,
        montoMax: datos.montoMax,
        periodicidad: datos.periodicidad,
        tasaEa: datos.tasaEa,
        vigenteDesde: datos.vigenteDesde,
        vigenteHasta: datos.vigenteHasta,
        creadoPor: actor.staffId,
      });
    },
  );
  return { id };
}

export async function editarCondicion(
  actor: Actor,
  id: string,
  datos: DatosCondicion,
): Promise<void> {
  exigirPermiso(actor, "condiciones.administrar");
  const evento = {
    accion: "condicion.editar",
    actorId: actor.userId,
    targetType: "condicion",
    targetId: id,
    metadata: {} as Record<string, unknown>,
  };
  await conAuditoria(evento, async (tx) => {
    const [actual] = await tx
      .select()
      .from(condicionesTasa)
      .where(eq(condicionesTasa.id, id))
      .for("update");
    if (!actual) {
      throw new ErrorDominio("NO_ENCONTRADO", "No existe la condición");
    }
    await validarSinSolape(tx, datos, id);
    await tx
      .update(condicionesTasa)
      .set({
        entidadId: datos.entidadId,
        plazoDias: datos.plazoDias,
        montoMin: datos.montoMin,
        montoMax: datos.montoMax,
        periodicidad: datos.periodicidad,
        tasaEa: datos.tasaEa,
        vigenteDesde: datos.vigenteDesde,
        vigenteHasta: datos.vigenteHasta,
      })
      .where(eq(condicionesTasa.id, id));
    // Diffs de los campos que cambian, en la auditoría (contratos.md §3).
    const cambios = [
      ["tasaEa", actual.tasaEa, datos.tasaEa],
      ["plazoDias", actual.plazoDias, datos.plazoDias],
      ["montoMin", actual.montoMin, datos.montoMin],
      ["montoMax", actual.montoMax, datos.montoMax],
      ["vigenteDesde", actual.vigenteDesde, datos.vigenteDesde],
      ["vigenteHasta", actual.vigenteHasta, datos.vigenteHasta],
    ]
      .filter(([, antes, despues]) => antes !== despues)
      .map(([campo, antes, despues]) => ({ campo, antes, despues }));
    evento.metadata = { cambios };
  });
}

export async function crearFestivo(actor: Actor, datos: DatosFestivo): Promise<void> {
  exigirPermiso(actor, "festivos.administrar");
  await conAuditoria(
    {
      accion: "festivo.crear",
      actorId: actor.userId,
      targetType: "festivo",
      targetId: datos.fecha,
      metadata: { nombre: datos.nombre },
    },
    async (tx) => {
      await tx.insert(festivos).values({ fecha: datos.fecha, nombre: datos.nombre });
    },
  ).catch((error: unknown) => {
    const envuelto = error as { cause?: { code?: string }; code?: string };
    if ((envuelto.cause ?? envuelto).code === "23505") {
      throw new ErrorDominio("CONFLICTO", "Ya existe un festivo con esa fecha");
    }
    throw error;
  });
}

export async function editarFestivo(actor: Actor, datos: DatosFestivo): Promise<void> {
  exigirPermiso(actor, "festivos.administrar");
  const evento = {
    accion: "festivo.editar",
    actorId: actor.userId,
    targetType: "festivo",
    targetId: datos.fecha,
    metadata: {} as Record<string, unknown>,
  };
  await conAuditoria(evento, async (tx) => {
    const [actual] = await tx
      .select({ nombre: festivos.nombre })
      .from(festivos)
      .where(eq(festivos.fecha, datos.fecha))
      .for("update");
    if (!actual) {
      throw new ErrorDominio("NO_ENCONTRADO", "No existe el festivo");
    }
    await tx.update(festivos).set({ nombre: datos.nombre }).where(eq(festivos.fecha, datos.fecha));
    evento.metadata = {
      cambios:
        actual.nombre === datos.nombre
          ? []
          : [{ campo: "nombre", antes: actual.nombre, despues: datos.nombre }],
    };
  });
}

// Quién creó cada condición, para marcar las DEMO (creado_por nulo) en la interfaz.
export async function nombreDeCreador(id: string | null): Promise<string | null> {
  if (!id) return null;
  const [fila] = await getDb()
    .select({ nombre: staffMembers.nombre })
    .from(staffMembers)
    .where(eq(staffMembers.id, id))
    .limit(1);
  return fila?.nombre ?? null;
}
