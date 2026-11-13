// Máquina de estados de la solicitud (docs/referencia/contratos.md §3), como datos.
// Solo las transiciones se ejecutan desde ejecutarTransicion(); aquí se decide si son válidas.

export const ESTADOS = [
  "borrador",
  "pendiente_validacion",
  "devuelta",
  "pendiente_firma",
  "firma_en_revision",
  "lista_para_enviar",
  "enviada_entidad",
  "cdt_constituido",
  "cancelada",
] as const;

export type Estado = (typeof ESTADOS)[number];

type Transicion = { desde: readonly Estado[]; hacia: Estado };

// Acción → desde qué estados y a cuál pasa. Las ediciones sin cambio de estado no están aquí.
export const TRANSICIONES = {
  enviar: { desde: ["borrador", "devuelta"], hacia: "pendiente_validacion" },
  aprobar: { desde: ["pendiente_validacion"], hacia: "pendiente_firma" },
  devolver: { desde: ["pendiente_validacion"], hacia: "devuelta" },
  cargar_firma: { desde: ["pendiente_firma"], hacia: "firma_en_revision" },
  aceptar_firma: { desde: ["firma_en_revision"], hacia: "lista_para_enviar" },
  rechazar_firma: { desde: ["firma_en_revision"], hacia: "pendiente_firma" },
  enviar_entidad: { desde: ["lista_para_enviar"], hacia: "enviada_entidad" },
  constituir: { desde: ["enviada_entidad"], hacia: "cdt_constituido" },
  cancelar: {
    desde: ESTADOS.filter((e) => e !== "cdt_constituido" && e !== "cancelada"),
    hacia: "cancelada",
  },
  editar_post_aprobacion: {
    desde: ["pendiente_firma", "firma_en_revision", "lista_para_enviar", "enviada_entidad"],
    hacia: "pendiente_firma",
  },
} satisfies Record<string, Transicion>;

export type Accion = keyof typeof TRANSICIONES;

export function transicionValida(accion: Accion, desde: string): boolean {
  const t: Transicion = TRANSICIONES[accion];
  return (t.desde as readonly string[]).includes(desde);
}

export function destinoDe(accion: Accion): Estado {
  return TRANSICIONES[accion].hacia;
}

// Estados en los que el cliente puede editar su borrador.
export const EDITABLES_CLIENTE: readonly Estado[] = ["borrador", "devuelta"];
