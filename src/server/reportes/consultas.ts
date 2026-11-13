import { and, asc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { getDb } from "@/server/db/client";
import { cdts, clientes, entidades, solicitudes, staffMembers } from "@/server/db/schema";

// Reportes de gerencia (E3-T3). Lectura agregada: se exige `reportes.ver` (coordinador y gerencia).
// "Vigente" = `estado = 'vigente'` y `fecha_venc >= hoy`, con "hoy" en America/Bogota.

export type FiltrosReporte = {
  desde?: string;
  hasta?: string;
  entidadId?: string;
  asesorId?: string;
};

export type Dias = 30 | 60 | 90;

export function exigirReportes(actor: Actor): void {
  if (!can(actor, "reportes.ver")) {
    throw new ErrorDominio("PROHIBIDO", "No tienes permiso para ver reportes");
  }
}

export function hoyBogota(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Suma días a una fecha yyyy-mm-dd con aritmética en UTC.
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio ?? 1970, (mes ?? 1) - 1, (dia ?? 1) + dias));
  return d.toISOString().slice(0, 10);
}

function condicionesCdt(filtros: FiltrosReporte) {
  const condiciones = [];
  if (filtros.entidadId) condiciones.push(eq(cdts.entidadId, filtros.entidadId));
  if (filtros.asesorId) condiciones.push(eq(clientes.asesorId, filtros.asesorId));
  if (filtros.desde) condiciones.push(gte(cdts.fechaApertura, filtros.desde));
  if (filtros.hasta) condiciones.push(lte(cdts.fechaApertura, filtros.hasta));
  return condiciones;
}

export type FilaInversion = {
  entidadId: string;
  entidadNombre: string;
  asesorId: string | null;
  asesorNombre: string | null;
  total: number;
};

// Total invertido por entidad y asesor del cliente (CDT vigentes).
export async function inversion(actor: Actor, filtros: FiltrosReporte = {}) {
  exigirReportes(actor);
  const filas = await getDb()
    .select({
      entidadId: entidades.id,
      entidadNombre: entidades.nombre,
      asesorId: clientes.asesorId,
      asesorNombre: staffMembers.nombre,
      total: sql<string>`sum(${cdts.valor})`,
    })
    .from(cdts)
    .innerJoin(clientes, eq(cdts.clienteId, clientes.id))
    .innerJoin(entidades, eq(cdts.entidadId, entidades.id))
    .leftJoin(staffMembers, eq(clientes.asesorId, staffMembers.id))
    .where(
      and(eq(cdts.estado, "vigente"), gte(cdts.fechaVenc, hoyBogota()), ...condicionesCdt(filtros)),
    )
    .groupBy(entidades.id, entidades.nombre, clientes.asesorId, staffMembers.nombre)
    .orderBy(asc(entidades.nombre), asc(staffMembers.nombre));

  const detalle: FilaInversion[] = filas.map((f) => ({ ...f, total: Number(f.total) }));
  return {
    detalle,
    porEntidad: agrupar(detalle, "entidadNombre"),
    porAsesor: agrupar(detalle, "asesorNombre"),
  };
}

function agrupar(
  detalle: FilaInversion[],
  campo: "entidadNombre" | "asesorNombre",
): { nombre: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const f of detalle) {
    const nombre = f[campo] ?? "Sin asesor";
    mapa.set(nombre, (mapa.get(nombre) ?? 0) + f.total);
  }
  return [...mapa.entries()].map(([nombre, total]) => ({ nombre, total }));
}

export type FilaVencimiento = {
  cdtId: string;
  cliente: string;
  entidad: string;
  numeroCdt: string;
  valor: number;
  vencimiento: string;
};

// CDT vigentes con vencimiento dentro de la ventana (hoy … hoy + dias), ascendente.
export async function vencimientos(actor: Actor, dias: Dias, filtros: FiltrosReporte = {}) {
  exigirReportes(actor);
  const hoy = hoyBogota();
  const filas = await getDb()
    .select({
      cdtId: cdts.id,
      cliente: clientes.nombre,
      entidad: entidades.nombre,
      numeroCdt: cdts.numeroCdt,
      valor: cdts.valor,
      vencimiento: cdts.fechaVenc,
    })
    .from(cdts)
    .innerJoin(clientes, eq(cdts.clienteId, clientes.id))
    .innerJoin(entidades, eq(cdts.entidadId, entidades.id))
    .where(
      and(
        eq(cdts.estado, "vigente"),
        gte(cdts.fechaVenc, hoy),
        lte(cdts.fechaVenc, sumarDias(hoy, dias)),
        ...condicionesCdt(filtros),
      ),
    )
    .orderBy(asc(cdts.fechaVenc), asc(cdts.numeroCdt));
  return filas.map((f): FilaVencimiento => ({ ...f, valor: Number(f.valor) }));
}

export type ResumenSolicitudes = {
  porEstado: { estado: string; cantidad: number }[];
  constituidas: number;
  promedioDias: number | null;
};

// Conteo por estado y promedio de días entre creación y constitución (solo las constituidas).
export async function resumenSolicitudes(
  actor: Actor,
  filtros: FiltrosReporte = {},
): Promise<ResumenSolicitudes> {
  exigirReportes(actor);
  const condiciones = [];
  if (filtros.entidadId) condiciones.push(eq(solicitudes.entidadId, filtros.entidadId));
  if (filtros.asesorId) condiciones.push(eq(solicitudes.asesorId, filtros.asesorId));
  if (filtros.desde) condiciones.push(gte(sql`${solicitudes.createdAt}::date`, filtros.desde));
  if (filtros.hasta) condiciones.push(lte(sql`${solicitudes.createdAt}::date`, filtros.hasta));

  const porEstado = await getDb()
    .select({ estado: solicitudes.estado, cantidad: sql<number>`count(*)::int` })
    .from(solicitudes)
    .where(condiciones.length > 0 ? and(...condiciones) : undefined)
    .groupBy(solicitudes.estado)
    .orderBy(asc(solicitudes.estado));

  const [promedio] = await getDb()
    .select({
      constituidas: sql<number>`count(*)::int`,
      dias: sql<
        string | null
      >`avg(extract(epoch from (${solicitudes.constituidaAt} - ${solicitudes.createdAt})) / 86400)`,
    })
    .from(solicitudes)
    .where(and(isNotNull(solicitudes.constituidaAt), ...condiciones));

  return {
    porEstado,
    constituidas: promedio?.constituidas ?? 0,
    promedioDias:
      promedio?.dias === null || promedio?.dias === undefined ? null : Number(promedio.dias),
  };
}

// Opciones de los filtros de la pantalla: entidades activas y asesores.
export async function opcionesFiltro(actor: Actor) {
  exigirReportes(actor);
  const [entidadesActivas, asesores] = await Promise.all([
    getDb()
      .select({ id: entidades.id, nombre: entidades.nombre })
      .from(entidades)
      .where(eq(entidades.activa, true))
      .orderBy(asc(entidades.nombre)),
    getDb()
      .select({ id: staffMembers.id, nombre: staffMembers.nombre })
      .from(staffMembers)
      .where(inArray(staffMembers.rol, ["asesor", "coordinador"]))
      .orderBy(asc(staffMembers.nombre)),
  ]);
  return { entidades: entidadesActivas, asesores };
}
