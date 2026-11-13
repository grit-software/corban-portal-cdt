"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodType } from "zod";
import {
  type DatosConstitucion,
  type ResultadoConstitucion,
  esquemaConstitucion,
} from "@/lib/portafolio/constitucion";
import { getActor } from "@/server/auth/actor";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { constituir } from "@/server/portafolio/constituir";

// Acciones del asesor sobre una solicitud. Contrato de contratos.md §1 para server actions:
// { ok: false, error: { code, message, fields? } } con los mismos códigos.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

async function ejecutar(trabajo: (actor: Actor) => Promise<void>): Promise<ResultadoConstitucion> {
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

// Registra la constitución (E3-T1): la solicitud pasa a cdt_constituido y se crea su CDT.
export async function registrarConstitucion(
  solicitudId: string,
  datos: unknown,
): Promise<ResultadoConstitucion> {
  return ejecutar(async (actor) => {
    if (!UUID.test(solicitudId)) {
      throw new ErrorDominio("NO_ENCONTRADO", "No encontramos esa solicitud");
    }
    const valor: DatosConstitucion = validar(esquemaConstitucion, datos);
    await constituir(actor, solicitudId, valor);
    revalidatePath(`/asesor/solicitudes/${solicitudId}`);
  });
}
