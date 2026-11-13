import { z } from "zod";

// Esquemas del borde HTTP (CLAUDE.md, regla 4): se validan antes de llegar al servicio.
export const TIPOS_DOC = ["CC", "CE", "TI", "PAS", "NUIP"] as const;

export const esquemaRegistro = z.object({
  tipoDoc: z.enum(TIPOS_DOC, { error: "Elige un tipo de documento válido" }),
  numDoc: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{5,20}$/, "El número de documento debe tener entre 5 y 20 caracteres"),
  nombre: z.string().trim().min(2, "Escribe tu nombre").max(120),
  email: z.email("Escribe un correo válido").transform((correo) => correo.trim().toLowerCase()),
  celular: z
    .string()
    .trim()
    .regex(/^\d{7,15}$/, "El celular solo tiene dígitos")
    .optional(),
});

export type DatosRegistro = z.infer<typeof esquemaRegistro>;
