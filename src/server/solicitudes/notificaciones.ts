import { and, desc, eq } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";
import { type Mensaje, enviar as enviarReal } from "@/server/correo/enviar";
import { type Plantilla, plantillas } from "@/server/correo/plantillas";
import { getDb } from "@/server/db/client";
import { cdts, clientes, solicitudEventos, solicitudes, staffMembers } from "@/server/db/schema";

// Correos de transición (E3-T4). Se llama después del commit: un fallo aquí nunca revierte la
// transición. Si el envío falla, `notificado_at` queda nulo y se registra el error sin datos
// personales (solo ids y el nombre del error).

export type EventoNotificable = { solicitudId: string; accion: string; hacia: string };
export type Enviar = (mensaje: Mensaje) => Promise<void>;

type Destino = "staff" | "cliente";

// Qué correo recibe cada estado de destino (contratos.md §10).
function reglaPara(hacia: string): Destino | null {
  switch (hacia) {
    case "pendiente_validacion":
    case "firma_en_revision":
      return "staff";
    case "devuelta":
    case "pendiente_firma":
    case "cdt_constituido":
      return "cliente";
    default:
      return null;
  }
}

async function eventoDeTransicion(evento: EventoNotificable): Promise<string | undefined> {
  const [fila] = await getDb()
    .select({ id: solicitudEventos.id })
    .from(solicitudEventos)
    .where(
      and(
        eq(solicitudEventos.solicitudId, evento.solicitudId),
        eq(solicitudEventos.tipo, "transicion"),
        eq(solicitudEventos.hacia, evento.hacia),
      ),
    )
    .orderBy(desc(solicitudEventos.createdAt))
    .limit(1);
  return fila?.id;
}

// Correos del staff: el asesor asignado o, si no tiene, todos los coordinadores activos.
async function correosStaff(solicitudId: string): Promise<string[]> {
  const [solicitud] = await getDb()
    .select({ asesorId: solicitudes.asesorId })
    .from(solicitudes)
    .where(eq(solicitudes.id, solicitudId))
    .limit(1);
  if (solicitud?.asesorId) {
    const [asesor] = await getDb()
      .select({ email: staffMembers.email, activo: staffMembers.activo })
      .from(staffMembers)
      .where(eq(staffMembers.id, solicitud.asesorId))
      .limit(1);
    if (asesor?.activo) return [asesor.email];
  }
  const coordinadores = await getDb()
    .select({ email: staffMembers.email })
    .from(staffMembers)
    .where(and(eq(staffMembers.rol, "coordinador"), eq(staffMembers.activo, true)));
  return coordinadores.map((c) => c.email);
}

async function correoCliente(solicitudId: string): Promise<string[]> {
  const [fila] = await getDb()
    .select({ email: clientes.email })
    .from(solicitudes)
    .innerJoin(clientes, eq(solicitudes.clienteId, clientes.id))
    .where(eq(solicitudes.id, solicitudId))
    .limit(1);
  return fila ? [fila.email] : [];
}

function enlace(destino: Destino, solicitudId: string): string {
  const base = getEnv().BETTER_AUTH_URL;
  return destino === "staff"
    ? `${base}/asesor/solicitudes/${solicitudId}`
    : `${base}/mi-cuenta/solicitudes/${solicitudId}`;
}

async function plantillaPara(evento: EventoNotificable, destino: Destino): Promise<Plantilla> {
  const [solicitud] = await getDb()
    .select({ codigo: solicitudes.codigo })
    .from(solicitudes)
    .where(eq(solicitudes.id, evento.solicitudId))
    .limit(1);
  const codigo = solicitud?.codigo ?? "";
  const url = enlace(destino, evento.solicitudId);
  switch (evento.hacia) {
    case "pendiente_validacion":
      return plantillas.pendiente_validacion({ codigo, enlace: url });
    case "firma_en_revision":
      return plantillas.firma_en_revision({ codigo, enlace: url });
    case "devuelta":
      return plantillas.devuelta({ codigo, enlace: url });
    case "pendiente_firma":
      return plantillas.pendiente_firma({ codigo, enlace: url });
    default: {
      const [cdt] = await getDb()
        .select({ numeroCdt: cdts.numeroCdt })
        .from(cdts)
        .where(eq(cdts.solicitudId, evento.solicitudId))
        .limit(1);
      return plantillas.cdt_constituido({ numeroCdt: cdt?.numeroCdt ?? "", codigo, enlace: url });
    }
  }
}

// Envía los correos de la transición y marca `notificado_at`. Devuelve si se notificó.
// Nunca lanza: los errores se registran.
export async function notificar(
  evento: EventoNotificable,
  enviar: Enviar = enviarReal,
): Promise<{ notificado: boolean }> {
  const destino = reglaPara(evento.hacia);
  if (!destino) return { notificado: false };
  try {
    const eventoId = await eventoDeTransicion(evento);
    const destinatarios =
      destino === "staff"
        ? await correosStaff(evento.solicitudId)
        : await correoCliente(evento.solicitudId);
    if (destinatarios.length === 0 || !eventoId) return { notificado: false };
    const plantilla = await plantillaPara(evento, destino);
    await Promise.all(
      destinatarios.map((para) =>
        enviar({ para, asunto: plantilla.asunto, html: plantilla.html, texto: plantilla.texto }),
      ),
    );
    await getDb()
      .update(solicitudEventos)
      .set({ notificadoAt: new Date() })
      .where(eq(solicitudEventos.id, eventoId));
    return { notificado: true };
  } catch (error) {
    log.error("no se pudo enviar la notificación de la transición", {
      solicitudId: evento.solicitudId,
      accion: evento.accion,
      hacia: evento.hacia,
      causa: error instanceof Error ? error.name : "desconocida",
    });
    return { notificado: false };
  }
}

// Punto de entrada de las rutas de transición: no espera el envío y nunca lanza.
export function notificarTransicion(evento: EventoNotificable): void {
  void notificar(evento).catch(() => undefined);
}
