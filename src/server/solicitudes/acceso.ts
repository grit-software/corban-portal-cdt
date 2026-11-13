import type { ActorCliente, Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";

// Guardas de acceso del área de cliente, en el orden de contratos.md §1: registro antes que
// consentimiento. Un staff que llama la API de cliente recibe PROHIBIDO.
export function exigirCliente(actor: Actor): ActorCliente & { clienteId: string } {
  if (actor.tipo !== "cliente") {
    throw new ErrorDominio("PROHIBIDO", "Esta acción es solo para clientes");
  }
  if (!actor.clienteId) {
    throw new ErrorDominio("PERFIL_REQUERIDO", "Completa tu registro antes de continuar");
  }
  if (!actor.consentimiento) {
    throw new ErrorDominio("CONSENTIMIENTO_REQUERIDO", "Autoriza el tratamiento de tus datos");
  }
  return { ...actor, clienteId: actor.clienteId };
}

// Lectura de una solicitud: el cliente debe tener consentimiento; el staff pasa y el filtro de
// visibilidad decide qué ve.
export function exigirAcceso(actor: Actor): void {
  if (actor.tipo === "cliente") {
    exigirCliente(actor);
  }
}
