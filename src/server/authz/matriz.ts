// Matriz de permisos de docs/referencia/contratos.md §2, codificada como datos.
// Celdas:
//   "propio"    → recurso.clienteId === actor.clienteId (solo cliente)
//   "asignado"  → recurso.asesorId === actor.staffId (solo staff)
//   "todos"     → cualquier staff, sin filtro
//   "si"        → sin filtro (cualquier actor autenticado)
//   "no"        → denegado
// Cambiar esta tabla exige cambiar también docs/referencia/contratos.md en el mismo commit.

export type Celda = "propio" | "asignado" | "todos" | "si" | "no";

export type FilaMatriz = {
  cliente: Celda;
  asesor: Celda;
  coordinador: Celda;
  gerencia: Celda;
  admin: Celda;
};

export const MATRIZ: Readonly<Record<string, FilaMatriz>> = {
  "solicitud.ver": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "todos",
    admin: "todos",
  },
  "solicitud.crear": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.editar": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.enviar": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.aprobar": {
    cliente: "no",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.devolver": {
    cliente: "no",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.cancelar": {
    cliente: "no",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.cargar_firma": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.revisar_firma": {
    cliente: "no",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.enviar_entidad": {
    cliente: "no",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.constituir": {
    cliente: "no",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "solicitud.reasignar": {
    cliente: "no",
    asesor: "no",
    coordinador: "todos",
    gerencia: "no",
    admin: "no",
  },
  "documento.descargar": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "todos",
  },
  "cliente.ver": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "no",
    admin: "todos",
  },
  "cliente.invitar": {
    cliente: "no",
    asesor: "si",
    coordinador: "si",
    gerencia: "no",
    admin: "no",
  },
  "cliente.reasignar": {
    cliente: "no",
    asesor: "no",
    coordinador: "si",
    gerencia: "no",
    admin: "no",
  },
  "portafolio.ver": {
    cliente: "propio",
    asesor: "asignado",
    coordinador: "todos",
    gerencia: "todos",
    admin: "todos",
  },
  "condiciones.ver": {
    cliente: "si",
    asesor: "si",
    coordinador: "si",
    gerencia: "si",
    admin: "si",
  },
  "condiciones.administrar": {
    cliente: "no",
    asesor: "no",
    coordinador: "si",
    gerencia: "no",
    admin: "no",
  },
  "festivos.administrar": {
    cliente: "no",
    asesor: "no",
    coordinador: "si",
    gerencia: "no",
    admin: "no",
  },
  "importacion.ejecutar": {
    cliente: "no",
    asesor: "no",
    coordinador: "si",
    gerencia: "no",
    admin: "si",
  },
  "reportes.ver": {
    cliente: "no",
    asesor: "no",
    coordinador: "si",
    gerencia: "si",
    admin: "no",
  },
  "staff.administrar": {
    cliente: "no",
    asesor: "no",
    coordinador: "no",
    gerencia: "no",
    admin: "si",
  },
};
