import { z } from "zod";
import { type Catalogo, valoresDe } from "./catalogos.ts";

// Esquemas por paso del asistente (contratos.md §6). Todo se guarda como texto; el dinero es
// solo dígitos; las fechas son aaaa-mm-dd. Cada esquema es parcial y estricto: solo acepta las
// claves de su paso.

const dinero = z.string().regex(/^\d{0,15}$/, "Escribe solo dígitos, sin puntos ni comas");
const fecha = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Usa la fecha como aaaa-mm-dd");
const digitos = z.string().regex(/^\d{0,15}$/, "Escribe solo dígitos");
const texto = z.string().max(200, "Máximo 200 caracteres");
const correo = z.union([z.email("Escribe un correo válido"), z.literal("")]);

function catalogo(nombre: Catalogo) {
  return z.union([
    z.enum(valoresDe(nombre), { error: "Elige una opción de la lista" }),
    z.literal(""),
  ]);
}

export const ESQUEMA_PASO = {
  cdt: z
    .object({
      valor: dinero,
      plazo_dias: dinero,
      fecha_apertura: fecha,
      tipo_cdt: catalogo("tipo_cdt"),
      forma_pago: catalogo("forma_pago"),
      ciudad: texto,
      oficina: texto,
      fecha_dilig: fecha,
    })
    .partial()
    .strict(),
  personal: z
    .object({
      nombre1: texto,
      nombre2: texto,
      apellido1: texto,
      apellido2: texto,
      tipo_doc: catalogo("tipo_doc"),
      num_doc: texto,
      exp_fecha: fecha,
      exp_lugar: texto,
      sexo: catalogo("sexo"),
      nac_fecha: fecha,
      nac_pais: texto,
      nac_ciudad: texto,
      nacionalidad: texto,
      estado_civil: catalogo("estado_civil"),
      personas_cargo: dinero,
      nivel_educ: catalogo("nivel_educ"),
      profesion: texto,
      email: correo,
      celular: digitos,
      tel_fijo: digitos,
      direccion: texto,
      barrio: texto,
      ciudad_res: texto,
      depto_res: texto,
      pais_res: texto,
      estrato: z.string().regex(/^[1-6]?$/, "El estrato va de 1 a 6"),
      tipo_vivienda: catalogo("tipo_vivienda"),
    })
    .partial()
    .strict(),
  laboral: z
    .object({
      ocupacion: catalogo("ocupacion"),
      empresa: texto,
      nit_empresa: dinero,
      cargo: texto,
      contrato: catalogo("contrato"),
      fecha_ingreso: fecha,
      dir_trab: texto,
      ciudad_trab: texto,
      depto_trab: texto,
      pais_trab: texto,
      tel_trab: digitos,
      ciiu: texto,
      actividad_desc: texto,
    })
    .partial()
    .strict(),
  financiera: z
    .object({
      ingresos: dinero,
      otros_ingresos: dinero,
      desc_otros: texto,
      egresos: dinero,
      activos: dinero,
      pasivos: dinero,
      declara_renta: catalogo("declara_renta"),
    })
    .partial()
    .strict(),
  pago: z
    .object({
      periodicidad: catalogo("periodicidad"),
      cta_banco: texto,
      cta_tipo: catalogo("cta_tipo"),
      cta_numero: dinero,
      cta_titular: texto,
    })
    .partial()
    .strict(),
} as const;

export type Paso = keyof typeof ESQUEMA_PASO;
export const PASOS = Object.keys(ESQUEMA_PASO) as Paso[];

// Claves que se copian a clientes.perfil al enviar y precargan la siguiente solicitud.
export const CLAVES_PERFIL = [
  ...Object.keys(ESQUEMA_PASO.personal.shape),
  ...Object.keys(ESQUEMA_PASO.laboral.shape),
  ...Object.keys(ESQUEMA_PASO.financiera.shape),
  "cta_banco",
  "cta_tipo",
  "cta_numero",
  "cta_titular",
] as const;

// Perfil del cliente: las claves de personal, laboral, financiera y la cuenta de pago.
export const esquemaPerfil = z
  .object({
    ...ESQUEMA_PASO.personal.shape,
    ...ESQUEMA_PASO.laboral.shape,
    ...ESQUEMA_PASO.financiera.shape,
    cta_banco: ESQUEMA_PASO.pago.shape.cta_banco,
    cta_tipo: ESQUEMA_PASO.pago.shape.cta_tipo,
    cta_numero: ESQUEMA_PASO.pago.shape.cta_numero,
    cta_titular: ESQUEMA_PASO.pago.shape.cta_titular,
  })
  .partial()
  .strict();

// Obligatorias para enviar a validación (contratos.md §6, en negrita). La entidad va en la
// columna entidad_id, no en datos.
export const OBLIGATORIAS = [
  "valor",
  "plazo_dias",
  "fecha_apertura",
  "tipo_cdt",
  "forma_pago",
  "ciudad",
  "nombre1",
  "apellido1",
  "tipo_doc",
  "num_doc",
  "celular",
  "direccion",
  "ciudad_res",
  "periodicidad",
  "cta_banco",
  "cta_tipo",
  "cta_numero",
  "cta_titular",
] as const;

// Envío: cada obligatoria no vacía. Un valor vacío o ausente produce un error por clave.
export const esquemaEnvio = z.object(
  Object.fromEntries(
    OBLIGATORIAS.map((clave) => [clave, z.string().min(1, "Campo obligatorio")]),
  ) as Record<(typeof OBLIGATORIAS)[number], z.ZodString>,
);
