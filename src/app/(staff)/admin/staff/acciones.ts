"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { cambiarRolStaff, crearStaff, desactivarStaff } from "@/server/auth/staff";

// Server actions de administración del staff (E3-T4). Validan el borde con zod y delegan en los
// servicios, que comprueban `staff.administrar` y auditan cada cambio.

const ROLES = ["asesor", "coordinador", "gerencia", "admin"] as const;

const esquemaAlta = z.object({
  email: z.string().trim().email("Escribe un correo válido"),
  nombre: z.string().trim().min(2, "Escribe el nombre"),
  rol: z.enum(ROLES, { error: "Elige un rol" }),
});

const esquemaRol = z.object({
  id: z.string().uuid(),
  rol: z.enum(ROLES, { error: "Elige un rol" }),
  motivo: z.string().trim().min(1, "Indica el motivo del cambio"),
});

const esquemaDesactivar = z.object({
  id: z.string().uuid(),
  motivo: z.string().trim().min(1, "Indica el motivo"),
});

async function actorActual() {
  const actor = await getActor(await headers());
  if (!actor) throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
  return actor;
}

function validar<T>(esquema: z.ZodType<T>, datos: Record<string, FormDataEntryValue | null>): T {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const mensaje = resultado.error.issues[0]?.message ?? "Revisa los datos";
    throw new ErrorDominio("VALIDACION", mensaje);
  }
  return resultado.data;
}

function texto(formulario: FormData): Record<string, FormDataEntryValue | null> {
  return Object.fromEntries(formulario.entries());
}

export async function crearMiembroAccion(formulario: FormData): Promise<void> {
  const datos = validar(esquemaAlta, texto(formulario));
  await crearStaff(await actorActual(), datos);
  revalidatePath("/admin/staff");
}

export async function cambiarRolAccion(formulario: FormData): Promise<void> {
  const datos = validar(esquemaRol, texto(formulario));
  await cambiarRolStaff(await actorActual(), datos);
  revalidatePath("/admin/staff");
}

export async function desactivarAccion(formulario: FormData): Promise<void> {
  const datos = validar(esquemaDesactivar, texto(formulario));
  await desactivarStaff(await actorActual(), datos);
  revalidatePath("/admin/staff");
}
