import type { Actor } from "./actor.ts";
import { type Celda, MATRIZ } from "./matriz.ts";

// Atributos del recurso que se evalúan contra el actor. Sin recurso, las celdas con alcance
// ("propio", "asignado") niegan: fallar cerrado.
export type Recurso = { clienteId?: string | null; asesorId?: string | null };

// Única decisión de permisos. Toda autorización del sistema pasa por aquí (CLAUDE.md, regla 5).
export function can(actor: Actor, accion: string, recurso?: Recurso): boolean {
  const fila = Object.hasOwn(MATRIZ, accion) ? MATRIZ[accion] : undefined;
  if (!fila) {
    return false;
  }
  if (actor.tipo === "cliente") {
    // Sin consentimiento vigente, el cliente no supera ninguna acción salvo condiciones.ver.
    if (!actor.consentimiento && accion !== "condiciones.ver") {
      return false;
    }
    return cumple(fila.cliente, actor, recurso);
  }
  return cumple(fila[actor.rol], actor, recurso);
}

function cumple(celda: Celda, actor: Actor, recurso?: Recurso): boolean {
  switch (celda) {
    case "si":
      return true;
    case "no":
      return false;
    case "todos":
      return actor.tipo === "staff";
    case "propio":
      return (
        actor.tipo === "cliente" &&
        actor.clienteId !== null &&
        recurso?.clienteId === actor.clienteId
      );
    case "asignado":
      return (
        actor.tipo === "staff" &&
        recurso?.asesorId !== undefined &&
        recurso.asesorId !== null &&
        recurso.asesorId === actor.staffId
      );
  }
}
