import { describe, expect, it } from "vitest";
import type { Actor, ActorCliente, ActorStaff, RolStaff } from "@/server/authz/actor";
import { can, type Recurso } from "@/server/authz/can";

// Tabla esperada: docs/referencia/contratos.md §2, escrita aquí a propósito (no se importa de
// matriz.ts). Columnas: cliente, asesor, coordinador, gerencia, admin.
// Celdas: "propio" y "asignado" = permitido solo si el recurso es del actor; "todos" y "sí" =
// permitido; "—" = denegado.
const ESPERADA: Record<string, [string, string, string, string, string]> = {
  "solicitud.ver": ["propio", "asignado", "todos", "todos", "todos"],
  "solicitud.crear": ["propio", "asignado", "todos", "—", "—"],
  "solicitud.editar": ["propio", "asignado", "todos", "—", "—"],
  "solicitud.enviar": ["propio", "asignado", "todos", "—", "—"],
  "solicitud.aprobar": ["—", "asignado", "todos", "—", "—"],
  "solicitud.devolver": ["—", "asignado", "todos", "—", "—"],
  "solicitud.cancelar": ["—", "asignado", "todos", "—", "—"],
  "solicitud.cargar_firma": ["propio", "asignado", "todos", "—", "—"],
  "solicitud.revisar_firma": ["—", "asignado", "todos", "—", "—"],
  "solicitud.enviar_entidad": ["—", "asignado", "todos", "—", "—"],
  "solicitud.constituir": ["—", "asignado", "todos", "—", "—"],
  "solicitud.reasignar": ["—", "—", "todos", "—", "—"],
  "documento.descargar": ["propio", "asignado", "todos", "—", "todos"],
  "cliente.ver": ["propio", "asignado", "todos", "—", "todos"],
  "cliente.invitar": ["—", "sí", "sí", "—", "—"],
  "cliente.reasignar": ["—", "—", "sí", "—", "—"],
  "portafolio.ver": ["propio", "asignado", "todos", "todos", "todos"],
  "condiciones.ver": ["sí", "sí", "sí", "sí", "sí"],
  "condiciones.administrar": ["—", "—", "sí", "—", "—"],
  "festivos.administrar": ["—", "—", "sí", "—", "—"],
  "importacion.ejecutar": ["—", "—", "sí", "—", "sí"],
  "reportes.ver": ["—", "—", "sí", "sí", "—"],
  "staff.administrar": ["—", "—", "—", "—", "sí"],
};

const COLUMNAS = ["cliente", "asesor", "coordinador", "gerencia", "admin"] as const;

// Recurso de referencia: pertenece al cliente "cli-1" y está asignado al asesor "ase-1".
const RECURSO: Recurso = { clienteId: "cli-1", asesorId: "ase-1" };

function actorCliente(duenio: boolean, consentimiento = true): ActorCliente {
  return {
    tipo: "cliente",
    userId: "usr-cliente",
    clienteId: duenio ? "cli-1" : "cli-2",
    email: "cliente@prueba.co",
    consentimiento,
  };
}

function actorStaff(rol: RolStaff, duenio: boolean): ActorStaff {
  return {
    tipo: "staff",
    userId: "usr-staff",
    staffId: duenio ? "ase-1" : "ase-9",
    rol,
    email: "staff@prueba.co",
  };
}

function permitidoSegunTabla(celda: string, duenio: boolean): boolean {
  if (celda === "—") {
    return false;
  }
  if (celda === "sí" || celda === "todos") {
    return true;
  }
  return duenio; // "propio" y "asignado"
}

describe("can(): matriz rol × acción (contratos.md §2)", () => {
  for (const [accion, celdas] of Object.entries(ESPERADA)) {
    COLUMNAS.forEach((columna, indice) => {
      for (const duenio of [true, false]) {
        const celda = celdas[indice] ?? "—";
        const etiqueta = duenio ? "propio/asignado" : "ajeno/no asignado";
        it(`${accion} · ${columna} · ${etiqueta} → ${celda}`, () => {
          const actor: Actor =
            columna === "cliente" ? actorCliente(duenio) : actorStaff(columna as RolStaff, duenio);
          expect(can(actor, accion, RECURSO)).toBe(permitidoSegunTabla(celda, duenio));
        });
      }
    });
  }

  it("rechaza una acción que no está en la matriz", () => {
    expect(can(actorStaff("admin", true), "accion.inexistente", RECURSO)).toBe(false);
  });

  it("una celda con alcance niega si el recurso no se pasa", () => {
    expect(can(actorCliente(true), "solicitud.ver")).toBe(false);
    expect(can(actorStaff("asesor", true), "solicitud.ver")).toBe(false);
  });
});

describe("can(): aislamiento de recursos ajenos (criterio 2)", () => {
  it("un asesor no asignado no ve la solicitud de otro asesor", () => {
    const otroAsesor: Recurso = { clienteId: "cli-1", asesorId: "ase-2" };
    expect(can(actorStaff("asesor", true), "solicitud.ver", otroAsesor)).toBe(false);
  });

  it("un cliente no ve un recurso que no es suyo", () => {
    const ajeno: Recurso = { clienteId: "cli-9", asesorId: "ase-1" };
    expect(can(actorCliente(true), "solicitud.ver", ajeno)).toBe(false);
  });

  it("un cliente sin clienteId (sin registro) no supera acciones con alcance", () => {
    const sinPerfil: ActorCliente = { ...actorCliente(true), clienteId: null };
    expect(can(sinPerfil, "solicitud.ver", { clienteId: null })).toBe(false);
  });
});

describe("can(): consentimiento del cliente", () => {
  it("sin consentimiento, un cliente solo supera condiciones.ver", () => {
    const sinConsentimiento = actorCliente(true, false);
    expect(can(sinConsentimiento, "condiciones.ver")).toBe(true);
    expect(can(sinConsentimiento, "solicitud.ver", RECURSO)).toBe(false);
    expect(can(sinConsentimiento, "solicitud.crear", RECURSO)).toBe(false);
  });
});
