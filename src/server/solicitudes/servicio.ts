import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import type { ZodType } from "zod";
import {
  CLAVES_PERFIL,
  ESQUEMA_PASO,
  OBLIGATORIAS,
  type Paso,
  PASOS,
  esquemaEnvio,
} from "@/lib/datos/esquemas";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { calcularParaSolicitud } from "@/server/condiciones/calcular";
import { getDb } from "@/server/db/client";
import { clientes, entidades, solicitudEventos, solicitudes } from "@/server/db/schema";
import { exigirAcceso, exigirCliente } from "./acceso.ts";
import { EDITABLES_CLIENTE } from "./estados.ts";
import { ejecutarTransicion } from "./transicion.ts";
import { visiblesPara } from "./visibilidad.ts";

// Servicio de solicitudes. Cada función autoriza antes de leer o escribir (CLAUDE.md, regla 5);
// lo que el actor no puede ver responde NO_ENCONTRADO.

type FilaSolicitud = typeof solicitudes.$inferSelect;
export type Periodicidad = FilaSolicitud["periodicidad"];

// Forma que ve el cliente: sin campos internos ni la condición cruda (api-v1.md).
export function presentar(fila: FilaSolicitud) {
  return {
    id: fila.id,
    codigo: fila.codigo,
    estado: fila.estado,
    entidadId: fila.entidadId,
    datos: fila.datos,
    valor: fila.valor,
    plazoDias: fila.plazoDias,
    periodicidad: fila.periodicidad,
    tasaEa: fila.tasaEa,
    fechaApertura: fila.fechaApertura,
    fechaVenc: fila.fechaVenc,
    actualizadaEn: fila.updatedAt,
  };
}

async function cargarVisible(actor: Actor, id: string): Promise<FilaSolicitud> {
  const [fila] = await getDb()
    .select()
    .from(solicitudes)
    .where(and(eq(solicitudes.id, id), visiblesPara(actor)))
    .limit(1);
  if (!fila) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
  }
  return fila;
}

// Precarga de la solicitud nueva desde el perfil del cliente.
export async function crearBorrador(actor: Actor, entrada: { entidadId: string }) {
  const cliente = exigirCliente(actor);
  const db = getDb();
  const [entidad] = await db
    .select({ id: entidades.id })
    .from(entidades)
    .where(and(eq(entidades.id, entrada.entidadId), eq(entidades.activa, true)))
    .limit(1);
  if (!entidad) {
    throw new ErrorDominio("NO_ENCONTRADO", "La entidad no existe");
  }
  const [registro] = await db
    .select({ perfil: clientes.perfil, asesorId: clientes.asesorId })
    .from(clientes)
    .where(and(eq(clientes.id, cliente.clienteId), sql`${clientes.deletedAt} is null`))
    .limit(1);
  if (!registro) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos tu registro");
  }

  const id = randomUUID();
  const datos = Object.fromEntries(
    CLAVES_PERFIL.filter((clave) => registro.perfil[clave] !== undefined).map((clave) => [
      clave,
      registro.perfil[clave] ?? "",
    ]),
  );
  await conAuditoria(
    {
      accion: "solicitud.crear",
      actorId: actor.userId,
      targetType: "solicitud",
      targetId: id,
      metadata: { entidadId: entrada.entidadId },
    },
    async (tx) => {
      await tx.insert(solicitudes).values({
        id,
        clienteId: cliente.clienteId,
        asesorId: registro.asesorId,
        entidadId: entrada.entidadId,
        estado: "borrador",
        datos,
        creadoPor: actor.userId,
      });
    },
  );
  return presentar(await cargarVisible(actor, id));
}

export async function listarMias(actor: Actor) {
  const cliente = exigirCliente(actor);
  const filas = await getDb()
    .select()
    .from(solicitudes)
    .where(and(eq(solicitudes.clienteId, cliente.clienteId), sql`${solicitudes.deletedAt} is null`))
    .orderBy(desc(solicitudes.createdAt));
  return filas.map(presentar);
}

// Detalle con eventos. El staff pasa la guarda; el filtro de visibilidad decide qué ve.
export async function obtenerSolicitud(actor: Actor, id: string) {
  exigirAcceso(actor);
  const fila = await cargarVisible(actor, id);
  if (actor.tipo === "staff" && !can(actor, "solicitud.ver", { asesorId: fila.asesorId })) {
    throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
  }
  const eventos = await getDb()
    .select({
      tipo: solicitudEventos.tipo,
      desde: solicitudEventos.desde,
      hacia: solicitudEventos.hacia,
      nota: solicitudEventos.nota,
      creadoEn: solicitudEventos.createdAt,
    })
    .from(solicitudEventos)
    .where(eq(solicitudEventos.solicitudId, id))
    .orderBy(solicitudEventos.createdAt);
  return { solicitud: presentar(fila), eventos };
}

// Edita solo las claves de un paso, validadas con su esquema. Solo en borrador o devuelta.
export async function actualizarPaso(
  actor: Actor,
  id: string,
  paso: Paso,
  datos: Record<string, unknown>,
) {
  const cliente = exigirCliente(actor);
  const previa = await cargarVisible(actor, id);
  if (
    !can(cliente, "solicitud.editar", { clienteId: previa.clienteId, asesorId: previa.asesorId })
  ) {
    throw new ErrorDominio("PROHIBIDO", "No puedes editar esta solicitud");
  }
  const resultado = ESQUEMA_PASO[paso].safeParse(datos);
  if (!resultado.success) {
    throw new ErrorDominio(
      "VALIDACION",
      "Revisa los campos marcados",
      fallos(resultado.error.issues),
    );
  }
  const validos = resultado.data as Record<string, string>;

  await conAuditoria(
    {
      accion: "solicitud.editar",
      actorId: actor.userId,
      targetType: "solicitud",
      targetId: id,
      metadata: { paso, claves: Object.keys(validos) },
    },
    async (tx) => {
      // La revisión del estado se repite con la fila bloqueada: no hay carrera con un envío.
      const [actual] = await tx
        .select({ estado: solicitudes.estado, datos: solicitudes.datos })
        .from(solicitudes)
        .where(eq(solicitudes.id, id))
        .for("update");
      if (!actual) {
        throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
      }
      if (!(EDITABLES_CLIENTE as readonly string[]).includes(actual.estado)) {
        throw new ErrorDominio("TRANSICION_INVALIDA", "Esta solicitud ya no se puede editar");
      }
      await tx
        .update(solicitudes)
        .set({ datos: { ...actual.datos, ...validos } })
        .where(eq(solicitudes.id, id));
    },
  );
  return presentar(await cargarVisible(actor, id));
}

// Envío a validación: obligatorias y formatos → condición aplicable → transición, evento,
// auditoría y copia de los datos al perfil del cliente, todo en una transacción.
export async function enviar(actor: Actor, id: string) {
  const cliente = exigirCliente(actor);
  const previa = await cargarVisible(actor, id);
  if (
    !can(cliente, "solicitud.enviar", { clienteId: previa.clienteId, asesorId: previa.asesorId })
  ) {
    throw new ErrorDominio("PROHIBIDO", "No puedes enviar esta solicitud");
  }
  if (!(EDITABLES_CLIENTE as readonly string[]).includes(previa.estado)) {
    throw new ErrorDominio("TRANSICION_INVALIDA", "Esta solicitud ya fue enviada");
  }
  const datos = previa.datos;
  const campos = validarCompleto(datos);
  if (Object.keys(campos).length > 0) {
    throw new ErrorDominio("VALIDACION", "Faltan datos para enviar la solicitud", campos);
  }

  // Sin condición aplicable el envío se rechaza aquí, con SIN_CONDICION o MONTO_MINIMO (422).
  await calcularParaSolicitud(cliente, {
    entidadId: previa.entidadId,
    valor: Number(datos.valor),
    plazoDias: Number(datos.plazo_dias),
    periodicidad: datos.periodicidad as Periodicidad & string,
    fechaApertura: datos.fecha_apertura ?? "",
  });

  const perfilNuevo = Object.fromEntries(
    CLAVES_PERFIL.filter((clave) => datos[clave] !== undefined).map((clave) => [
      clave,
      datos[clave] ?? "",
    ]),
  );
  await conAuditoria(
    {
      accion: "solicitud.enviar",
      actorId: actor.userId,
      targetType: "solicitud",
      targetId: id,
      metadata: { desde: previa.estado, hacia: "pendiente_validacion" },
    },
    async (tx) => {
      await ejecutarTransicion(tx, {
        solicitudId: id,
        accion: "enviar",
        actorUserId: actor.userId,
      });
      // Valores que el asesor ve; tasa y vencimiento se fijan solo al aprobar.
      await tx
        .update(solicitudes)
        .set({
          valor: Number(datos.valor),
          plazoDias: Number(datos.plazo_dias),
          periodicidad: datos.periodicidad as Periodicidad & string,
          fechaApertura: datos.fecha_apertura ?? null,
        })
        .where(eq(solicitudes.id, id));
      await tx
        .update(clientes)
        .set({
          perfil: sql`coalesce(${clientes.perfil}, '{}'::jsonb) || ${JSON.stringify(perfilNuevo)}::jsonb`,
        })
        .where(eq(clientes.id, cliente.clienteId));
    },
  );
  return presentar(await cargarVisible(actor, id));
}

// Errores de zod como fields: la primera falla por clave gana.
function fallos(
  issues: readonly { path: readonly PropertyKey[]; message: string; code: string }[],
) {
  const campos: Record<string, string> = {};
  for (const problema of issues) {
    const clave = problema.path.map(String).join(".") || "formulario";
    campos[clave] ??= problema.code === "invalid_type" ? "Campo obligatorio" : problema.message;
  }
  return campos;
}

// Valida lo que ya hay en datos (formato por paso) y que estén todas las obligatorias.
function validarCompleto(datos: Record<string, string>): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const paso of PASOS) {
    const esquema = ESQUEMA_PASO[paso] as ZodType;
    const claves = Object.keys(ESQUEMA_PASO[paso].shape);
    const parte = Object.fromEntries(claves.filter((c) => c in datos).map((c) => [c, datos[c]]));
    const resultado = esquema.safeParse(parte);
    if (!resultado.success) {
      Object.assign(campos, fallos(resultado.error.issues));
    }
  }
  const faltantes = esquemaEnvio.safeParse(
    Object.fromEntries(OBLIGATORIAS.map((c) => [c, datos[c]])),
  );
  if (!faltantes.success) {
    Object.assign(campos, fallos(faltantes.error.issues));
  }
  return campos;
}
