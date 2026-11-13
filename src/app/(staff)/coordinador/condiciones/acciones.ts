"use server";

import { headers } from "next/headers";
import type { ZodType } from "zod";
import { getActor } from "@/server/auth/actor";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import {
  type DatosCondicion,
  type DatosFestivo,
  esquemaCondicion,
  esquemaFestivo,
} from "@/server/condiciones/esquemas";
import {
  crearCondicion,
  crearFestivo,
  editarCondicion,
  editarFestivo,
} from "@/server/condiciones/repositorio";

// Acciones del coordinador. Contrato de contratos.md §1 para server actions:
// { ok: false, error: { code, message, fields? } } con los mismos códigos.
export type ResultadoAccion =
  | { ok: true }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

function validar<T>(esquema: ZodType<T>, datos: unknown): T {
  const resultado = esquema.safeParse(datos);
  if (!resultado.success) {
    const campos: Record<string, string> = {};
    for (const problema of resultado.error.issues) {
      campos[problema.path.map(String).join(".") || "formulario"] ??= problema.message;
    }
    throw new ErrorDominio("VALIDACION", "Revisa los campos marcados", campos);
  }
  return resultado.data;
}

async function ejecutar(trabajo: (actor: Actor) => Promise<void>): Promise<ResultadoAccion> {
  try {
    const actor = await getActor(await headers());
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    await trabajo(actor);
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      };
    }
    return { ok: false, error: { code: "ERROR_INTERNO", message: "Ocurrió un error interno" } };
  }
}

export async function guardarCondicion(
  id: string | null,
  datos: unknown,
): Promise<ResultadoAccion> {
  return ejecutar(async (actor) => {
    const valor: DatosCondicion = validar(esquemaCondicion, datos);
    if (id) {
      await editarCondicion(actor, id, valor);
    } else {
      await crearCondicion(actor, valor);
    }
  });
}

export async function guardarFestivo(datos: unknown, editar: boolean): Promise<ResultadoAccion> {
  return ejecutar(async (actor) => {
    const valor: DatosFestivo = validar(esquemaFestivo, datos);
    if (editar) {
      await editarFestivo(actor, valor);
    } else {
      await crearFestivo(actor, valor);
    }
  });
}
