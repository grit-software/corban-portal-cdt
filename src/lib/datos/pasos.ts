import type { Catalogo } from "./catalogos.ts";
import { ESQUEMA_PASO, PASOS, type Paso } from "./esquemas.ts";

// Descripción de los pasos del asistente: campos, tipo de cada uno y cuáles son obligatorios
// (contratos.md §6). Puro: lo usan el servidor (validación) y el navegador (formularios).

export type TipoCampo =
  | "texto"
  | "fecha"
  | "digitos"
  | "dinero"
  | "correo"
  | "catalogo"
  | "plazo"
  | "periodicidad";

export type CampoUI = {
  nombre: string;
  etiqueta: string;
  tipo: TipoCampo;
  catalogo?: Catalogo;
  requerido?: boolean;
};

export const PASOS_UI: Record<Paso, { titulo: string; campos: CampoUI[] }> = {
  cdt: {
    titulo: "Tu CDT",
    campos: [
      { nombre: "valor", etiqueta: "Valor a invertir (pesos)", tipo: "dinero", requerido: true },
      { nombre: "plazo_dias", etiqueta: "Plazo", tipo: "plazo", requerido: true },
      { nombre: "fecha_apertura", etiqueta: "Fecha de apertura", tipo: "fecha", requerido: true },
      {
        nombre: "tipo_cdt",
        etiqueta: "Tipo de CDT",
        tipo: "catalogo",
        catalogo: "tipo_cdt",
        requerido: true,
      },
      {
        nombre: "forma_pago",
        etiqueta: "Forma de pago",
        tipo: "catalogo",
        catalogo: "forma_pago",
        requerido: true,
      },
      { nombre: "ciudad", etiqueta: "Ciudad de diligenciamiento", tipo: "texto", requerido: true },
      { nombre: "oficina", etiqueta: "Oficina", tipo: "texto" },
      { nombre: "fecha_dilig", etiqueta: "Fecha de diligenciamiento", tipo: "fecha" },
    ],
  },
  personal: {
    titulo: "Tus datos personales",
    campos: [
      { nombre: "nombre1", etiqueta: "Primer nombre", tipo: "texto", requerido: true },
      { nombre: "nombre2", etiqueta: "Segundo nombre", tipo: "texto" },
      { nombre: "apellido1", etiqueta: "Primer apellido", tipo: "texto", requerido: true },
      { nombre: "apellido2", etiqueta: "Segundo apellido", tipo: "texto" },
      {
        nombre: "tipo_doc",
        etiqueta: "Tipo de documento",
        tipo: "catalogo",
        catalogo: "tipo_doc",
        requerido: true,
      },
      { nombre: "num_doc", etiqueta: "Número de documento", tipo: "digitos", requerido: true },
      { nombre: "exp_fecha", etiqueta: "Fecha de expedición", tipo: "fecha" },
      { nombre: "exp_lugar", etiqueta: "Lugar de expedición", tipo: "texto" },
      { nombre: "sexo", etiqueta: "Sexo", tipo: "catalogo", catalogo: "sexo" },
      { nombre: "nac_fecha", etiqueta: "Fecha de nacimiento", tipo: "fecha" },
      { nombre: "nac_pais", etiqueta: "País de nacimiento", tipo: "texto" },
      { nombre: "nac_ciudad", etiqueta: "Ciudad de nacimiento", tipo: "texto" },
      { nombre: "nacionalidad", etiqueta: "Nacionalidad", tipo: "texto" },
      {
        nombre: "estado_civil",
        etiqueta: "Estado civil",
        tipo: "catalogo",
        catalogo: "estado_civil",
      },
      { nombre: "personas_cargo", etiqueta: "Personas a cargo", tipo: "digitos" },
      {
        nombre: "nivel_educ",
        etiqueta: "Nivel educativo",
        tipo: "catalogo",
        catalogo: "nivel_educ",
      },
      { nombre: "profesion", etiqueta: "Profesión u oficio", tipo: "texto" },
      { nombre: "email", etiqueta: "Correo electrónico", tipo: "correo" },
      { nombre: "celular", etiqueta: "Celular", tipo: "digitos", requerido: true },
      { nombre: "tel_fijo", etiqueta: "Teléfono fijo", tipo: "digitos" },
      { nombre: "direccion", etiqueta: "Dirección de residencia", tipo: "texto", requerido: true },
      { nombre: "barrio", etiqueta: "Barrio", tipo: "texto" },
      { nombre: "ciudad_res", etiqueta: "Ciudad de residencia", tipo: "texto", requerido: true },
      { nombre: "depto_res", etiqueta: "Departamento", tipo: "texto" },
      { nombre: "pais_res", etiqueta: "País de residencia", tipo: "texto" },
      { nombre: "estrato", etiqueta: "Estrato", tipo: "digitos" },
      {
        nombre: "tipo_vivienda",
        etiqueta: "Tipo de vivienda",
        tipo: "catalogo",
        catalogo: "tipo_vivienda",
      },
    ],
  },
  laboral: {
    titulo: "Tu situación laboral",
    campos: [
      { nombre: "ocupacion", etiqueta: "Ocupación", tipo: "catalogo", catalogo: "ocupacion" },
      { nombre: "empresa", etiqueta: "Empresa", tipo: "texto" },
      { nombre: "nit_empresa", etiqueta: "NIT de la empresa", tipo: "digitos" },
      { nombre: "cargo", etiqueta: "Cargo", tipo: "texto" },
      { nombre: "contrato", etiqueta: "Tipo de contrato", tipo: "catalogo", catalogo: "contrato" },
      { nombre: "fecha_ingreso", etiqueta: "Fecha de ingreso", tipo: "fecha" },
      { nombre: "dir_trab", etiqueta: "Dirección del trabajo", tipo: "texto" },
      { nombre: "ciudad_trab", etiqueta: "Ciudad del trabajo", tipo: "texto" },
      { nombre: "depto_trab", etiqueta: "Departamento del trabajo", tipo: "texto" },
      { nombre: "pais_trab", etiqueta: "País del trabajo", tipo: "texto" },
      { nombre: "tel_trab", etiqueta: "Teléfono del trabajo", tipo: "digitos" },
      { nombre: "ciiu", etiqueta: "Código CIIU", tipo: "texto" },
      { nombre: "actividad_desc", etiqueta: "Descripción de la actividad", tipo: "texto" },
    ],
  },
  financiera: {
    titulo: "Tu información financiera",
    campos: [
      { nombre: "ingresos", etiqueta: "Ingresos mensuales (pesos)", tipo: "dinero" },
      { nombre: "otros_ingresos", etiqueta: "Otros ingresos (pesos)", tipo: "dinero" },
      { nombre: "desc_otros", etiqueta: "Origen de otros ingresos", tipo: "texto" },
      { nombre: "egresos", etiqueta: "Egresos mensuales (pesos)", tipo: "dinero" },
      { nombre: "activos", etiqueta: "Activos (pesos)", tipo: "dinero" },
      { nombre: "pasivos", etiqueta: "Pasivos (pesos)", tipo: "dinero" },
      {
        nombre: "declara_renta",
        etiqueta: "¿Declaras renta?",
        tipo: "catalogo",
        catalogo: "declara_renta",
      },
    ],
  },
  pago: {
    titulo: "Pago de intereses y cuenta",
    campos: [
      {
        nombre: "periodicidad",
        etiqueta: "Periodicidad de pago de intereses",
        tipo: "periodicidad",
        requerido: true,
      },
      { nombre: "cta_banco", etiqueta: "Banco de la cuenta", tipo: "texto", requerido: true },
      {
        nombre: "cta_tipo",
        etiqueta: "Tipo de cuenta",
        tipo: "catalogo",
        catalogo: "cta_tipo",
        requerido: true,
      },
      { nombre: "cta_numero", etiqueta: "Número de cuenta", tipo: "digitos", requerido: true },
      { nombre: "cta_titular", etiqueta: "Titular de la cuenta", tipo: "texto", requerido: true },
    ],
  },
};

// Orden del asistente: los cinco pasos y el resumen. Vive aquí (puro) para que la página del
// servidor y el componente del navegador usen la misma lista.
export const ORDEN_ASISTENTE = [...PASOS, "resumen"] as const;
export type PasoAsistente = (typeof ORDEN_ASISTENTE)[number];

// Paso al que pertenece cada campo, para llevar al cliente al error.
export function pasoDelCampo(nombre: string): Paso | undefined {
  return PASOS.find((paso) => PASOS_UI[paso].campos.some((c) => c.nombre === nombre));
}

// Validación del formulario de un paso: el esquema de servidor más las obligatorias.
export function esquemaFormulario(paso: Paso) {
  const requeridos = PASOS_UI[paso].campos.filter((c) => c.requerido).map((c) => c.nombre);
  return ESQUEMA_PASO[paso].superRefine((valores, ctx) => {
    for (const nombre of requeridos) {
      const valor = (valores as Record<string, unknown>)[nombre];
      if (typeof valor !== "string" || valor.trim() === "") {
        ctx.addIssue({ code: "custom", path: [nombre], message: "Campo obligatorio" });
      }
    }
  });
}

export const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: "Borrador",
  pendiente_validacion: "Pendiente de validación",
  devuelta: "Devuelta: revisa tus datos",
  pendiente_firma: "Pendiente de firma",
  firma_en_revision: "Firma en revisión",
  lista_para_enviar: "Lista para enviar",
  enviada_entidad: "Enviada a la entidad",
  cdt_constituido: "CDT constituido",
  cancelada: "Cancelada",
};

// Siguiente paso que espera el cliente según el estado.
export const SIGUIENTE_PASO_CLIENTE: Record<string, string> = {
  borrador: "Completa tu solicitud y envíala a validación.",
  devuelta: "Revisa las observaciones de tu asesor y vuelve a enviar.",
  pendiente_validacion: "Tu asesor la está revisando.",
  pendiente_firma: "Descarga tus formatos y sube la firma.",
  firma_en_revision: "Tu asesor revisa la firma.",
  lista_para_enviar: "Tu asesor la enviará a la entidad.",
  enviada_entidad: "La entidad está constituyendo tu CDT.",
  cdt_constituido: "Tu CDT ya está constituido.",
  cancelada: "Esta solicitud fue cancelada.",
};
