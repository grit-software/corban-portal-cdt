import { and, asc, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { hoyBogota } from "@/server/condiciones/opciones";
import { getDb } from "@/server/db/client";
import {
  clientes,
  condicionesTasa,
  documentos,
  solicitudEventos,
  solicitudVersiones,
  solicitudes,
} from "@/server/db/schema";
import { visiblesPara } from "./visibilidad.ts";

// Consultas del espacio de trabajo del asesor (E2-T7). Todo filtra por visibilidad dentro del
// WHERE; la paginación es en el servidor, de a 25.

export const POR_PAGINA = 25;

const ESTADOS_BANDEJA = ["pendiente_validacion", "firma_en_revision"] as const;
const ESTADOS_CON_ALERTA = ["pendiente_firma", "firma_en_revision", "lista_para_enviar"] as const;

// Texto del usuario en ILIKE: los comodines se escapan para que cuenten como texto.
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

const columnas = {
  id: solicitudes.id,
  codigo: solicitudes.codigo,
  estado: solicitudes.estado,
  entidadId: solicitudes.entidadId,
  asesorId: solicitudes.asesorId,
  clienteNombre: clientes.nombre,
  clienteDocumento: clientes.numDoc,
  valor: solicitudes.valor,
  actualizadaEn: solicitudes.updatedAt,
};

// Bandeja: primero validación y firma en revisión; luego el resto, por última actualización.
export async function bandeja(actor: Actor, pagina = 1) {
  const pag = Math.max(1, pagina);
  const prioridad = sql`case when ${solicitudes.estado} in (${sql.join(
    ESTADOS_BANDEJA.map((e) => sql`${e}`),
    sql`, `,
  )}) then 0 else 1 end`;
  const filas = await getDb()
    .select(columnas)
    .from(solicitudes)
    .innerJoin(clientes, eq(clientes.id, solicitudes.clienteId))
    .where(and(visiblesPara(actor), isNull(clientes.deletedAt)))
    .orderBy(prioridad, desc(solicitudes.updatedAt))
    .limit(POR_PAGINA)
    .offset((pag - 1) * POR_PAGINA);
  return { filas, pagina: pag, porPagina: POR_PAGINA };
}

export type FiltrosListado = {
  q?: string;
  estado?: string;
  entidad?: string;
  asesor?: string;
  pagina?: number;
};

// Listado con búsqueda por código, nombre o documento. El filtro de asesor es solo del coordinador.
export async function listado(actor: Actor, filtros: FiltrosListado) {
  const pag = Math.max(1, filtros.pagina ?? 1);
  const condiciones: SQL[] = [visiblesPara(actor) ?? sql`true`, isNull(clientes.deletedAt)];

  const q = filtros.q?.trim();
  if (q) {
    const patron = `%${escaparLike(q)}%`;
    const coincidencia = or(
      ilike(solicitudes.codigo, patron),
      ilike(clientes.nombre, patron),
      ilike(clientes.numDoc, patron),
    );
    if (coincidencia) condiciones.push(coincidencia);
  }
  if (filtros.estado) condiciones.push(eq(solicitudes.estado, filtros.estado as never));
  if (filtros.entidad) condiciones.push(eq(solicitudes.entidadId, filtros.entidad));
  if (filtros.asesor && actor.tipo === "staff" && actor.rol === "coordinador") {
    condiciones.push(eq(solicitudes.asesorId, filtros.asesor));
  }

  const donde = and(...condiciones);
  const db = getDb();
  const [total] = await db
    .select({ n: count() })
    .from(solicitudes)
    .innerJoin(clientes, eq(clientes.id, solicitudes.clienteId))
    .where(donde);
  const filas = await db
    .select(columnas)
    .from(solicitudes)
    .innerJoin(clientes, eq(clientes.id, solicitudes.clienteId))
    .where(donde)
    .orderBy(asc(solicitudes.createdAt))
    .limit(POR_PAGINA)
    .offset((pag - 1) * POR_PAGINA);
  return { filas, total: Number(total?.n ?? 0), pagina: pag, porPagina: POR_PAGINA };
}

// Detalle del equipo: eventos, versiones, documentos por versión y alerta de vigencia.
export async function detalleStaff(actor: Actor, id: string) {
  if (actor.tipo !== "staff") {
    throw new ErrorDominio("PROHIBIDO", "Esta vista es solo para el equipo");
  }
  const db = getDb();
  const [fila] = await db
    .select()
    .from(solicitudes)
    .where(and(eq(solicitudes.id, id), visiblesPara(actor)))
    .limit(1);
  if (!fila || !can(actor, "solicitud.ver", { asesorId: fila.asesorId })) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
  }

  const eventos = await db
    .select({
      tipo: solicitudEventos.tipo,
      desde: solicitudEventos.desde,
      hacia: solicitudEventos.hacia,
      nota: solicitudEventos.nota,
      creadoEn: solicitudEventos.createdAt,
    })
    .from(solicitudEventos)
    .where(eq(solicitudEventos.solicitudId, id))
    .orderBy(asc(solicitudEventos.createdAt));
  const versiones = await db
    .select({
      numero: solicitudVersiones.numero,
      condiciones: solicitudVersiones.condiciones,
      motivo: solicitudVersiones.motivo,
      creadoEn: solicitudVersiones.createdAt,
    })
    .from(solicitudVersiones)
    .where(eq(solicitudVersiones.solicitudId, id))
    .orderBy(asc(solicitudVersiones.numero));
  const docs = await db
    .select({
      id: documentos.id,
      version: documentos.version,
      tipo: documentos.tipo,
      docKey: documentos.docKey,
      estado: documentos.estado,
      nombreArchivo: documentos.nombreArchivo,
    })
    .from(documentos)
    .where(eq(documentos.solicitudId, id))
    .orderBy(asc(documentos.version));

  return {
    solicitud: fila,
    eventos,
    versiones,
    documentos: docs,
    alertaVigencia: await alertaVigencia(fila),
  };
}

// Alerta cuando la condición congelada ya no está vigente (contratos.md §3).
async function alertaVigencia(fila: typeof solicitudes.$inferSelect): Promise<boolean> {
  if (!fila.condicionId || !(ESTADOS_CON_ALERTA as readonly string[]).includes(fila.estado)) {
    return false;
  }
  const [condicion] = await getDb()
    .select({ vigenteHasta: condicionesTasa.vigenteHasta })
    .from(condicionesTasa)
    .where(eq(condicionesTasa.id, fila.condicionId))
    .limit(1);
  return Boolean(condicion?.vigenteHasta && condicion.vigenteHasta < hoyBogota());
}
