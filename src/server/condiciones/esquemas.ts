import { z } from "zod";
import { PERIODICIDADES } from "@/server/db/schema";

// Esquemas del borde (CLAUDE.md, regla 4). Los montos llegan como enteros en pesos.
const fechaIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa la fecha en formato aaaa-mm-dd");

export const esquemaCondicion = z
  .object({
    entidadId: z.string().min(1, "Elige una entidad"),
    plazoDias: z.number().int().min(1, "El plazo debe ser de al menos 1 día").max(3650),
    montoMin: z.number().int().min(0, "El monto mínimo no puede ser negativo"),
    montoMax: z.number().int().min(0).nullable(),
    periodicidad: z.enum(PERIODICIDADES, { error: "Elige una periodicidad válida" }),
    tasaEa: z
      .string()
      .regex(/^\d{1,2}\.\d{4}$/, "La tasa va con cuatro decimales, por ejemplo 10.5000"),
    vigenteDesde: fechaIso,
    vigenteHasta: fechaIso.nullable(),
  })
  .refine((c) => c.montoMax === null || c.montoMax >= c.montoMin, {
    message: "El monto máximo no puede ser menor que el mínimo",
    path: ["montoMax"],
  })
  .refine((c) => c.vigenteHasta === null || c.vigenteHasta >= c.vigenteDesde, {
    message: "La vigencia termina antes de empezar",
    path: ["vigenteHasta"],
  });

export type DatosCondicion = z.infer<typeof esquemaCondicion>;

export const esquemaFestivo = z.object({
  fecha: fechaIso,
  nombre: z.string().trim().min(2, "Escribe el nombre del festivo").max(120),
});

export type DatosFestivo = z.infer<typeof esquemaFestivo>;
