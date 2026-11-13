"use server";

import { headers } from "next/headers";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { guardarPerfil } from "@/server/importacion/perfiles";
import type { Mapeo } from "@/server/importacion/normalizar";

// Guarda (o actualiza) un perfil de mapeo con nombre. Solo coordinador y admin.
export async function guardarPerfilAccion(
  nombre: string,
  mapeo: Mapeo,
): Promise<{ id: string; nombre: string }> {
  const actor = await getActor(await headers());
  if (!actor) {
    throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
  }
  return guardarPerfil(actor, { nombre, mapeo });
}
