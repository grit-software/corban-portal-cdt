import { log } from "@/lib/logger";

// Stub de notificaciones (E2-T5): solo registra el evento. Se llama después del commit, así
// que un fallo aquí nunca revierte la transición. Los correos reales llegan en el epic 03.
export type EventoNotificable = { solicitudId: string; accion: string; hacia: string };

export function notificarTransicion(evento: EventoNotificable): void {
  log.info("transición notificable", { ...evento });
}
