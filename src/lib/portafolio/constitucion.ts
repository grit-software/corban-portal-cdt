import { z } from "zod";

// Datos finales con los que se registra la constitución de un CDT (E3-T1). Puro: lo usan el borde
// (server action), el servicio y el formulario del asesor. Dinero en pesos enteros; fechas
// de negocio como yyyy-mm-dd.

// Fecha real del calendario (rechaza 2026-02-30 y similares).
function fechaReal(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

const MENSAJE_FECHA = "Usa una fecha real con formato aaaa-mm-dd";

export const esquemaConstitucion = z
  .object({
    numeroCdt: z
      .string({ error: "Indica el número del CDT" })
      .trim()
      .min(1, "Indica el número del CDT")
      .max(40, "El número del CDT es demasiado largo"),
    valor: z
      .number({ error: "Indica el valor en pesos" })
      .int("El valor debe ser un número entero de pesos")
      .positive("El valor debe ser mayor que cero"),
    tasaEa: z
      .string({ error: "Indica la tasa efectiva anual" })
      .trim()
      .regex(/^\d{1,2}(\.\d{1,4})?$/, "Usa la tasa como 10.5000 (hasta 4 decimales)"),
    fechaApertura: z.string({ error: MENSAJE_FECHA }).refine(fechaReal, MENSAJE_FECHA),
    fechaVenc: z.string({ error: MENSAJE_FECHA }).refine(fechaReal, MENSAJE_FECHA),
  })
  .refine((datos) => datos.fechaVenc > datos.fechaApertura, {
    path: ["fechaVenc"],
    message: "El vencimiento debe ser posterior a la apertura",
  });

export type DatosConstitucion = z.infer<typeof esquemaConstitucion>;

// Contrato de las server actions (contratos.md §1): mismo sobre de error que el resto.
export type ResultadoConstitucion =
  | { ok: true }
  | {
      ok: false;
      error: { code: string; message: string; fields?: Record<string, string> };
    };
