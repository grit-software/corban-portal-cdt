// Destinos válidos para una columna del Excel (E3-T2). Las claves `cliente.<clave>` que no son
// fijas se guardan en `clientes.perfil` y precargan la siguiente solicitud.

export const DESTINOS_FIJOS = [
  "cliente.tipo_doc",
  "cliente.num_doc",
  "cliente.nombres",
  "cliente.email",
  "cliente.celular",
  "cdt.entidad",
  "cdt.numero_cdt",
  "cdt.valor",
  "cdt.tasa_ea",
  "cdt.fecha_apertura",
  "cdt.fecha_venc",
  "cdt.periodicidad",
  "cdt.estado",
  "ignorar",
] as const;

export type Destino = (typeof DESTINOS_FIJOS)[number] | `cliente.${string}`;

const CAMPOS_FIJOS_CLIENTE = new Set(["tipo_doc", "num_doc", "nombres", "email", "celular"]);

// Acepta los destinos fijos y cualquier `cliente.<clave>` en snake_case que no sea un campo fijo
// del cliente (esas claves son el perfil del asistente).
export function esDestinoValido(destino: string): boolean {
  if ((DESTINOS_FIJOS as readonly string[]).includes(destino)) return true;
  if (!destino.startsWith("cliente.")) return false;
  const clave = destino.slice("cliente.".length);
  return /^[a-z][a-z0-9_]*$/.test(clave) && !CAMPOS_FIJOS_CLIENTE.has(clave);
}
