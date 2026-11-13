import { asc } from "drizzle-orm";
import type { Actor } from "@/server/authz/actor";
import { can } from "@/server/authz/can";
import { ErrorDominio } from "@/server/authz/errores";
import { getDb } from "@/server/db/client";
import { importPerfiles } from "@/server/db/schema";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { type Mapeo, erroresDeMapeo } from "@/server/importacion/normalizar";
import { esDestinoValido } from "@/server/importacion/catalogo";

// Perfiles de mapeo de columnas (E3-T2): un nombre y el mapeo `{ columna: destino }`.

export function exigirImportacion(actor: Actor): void {
  if (!can(actor, "importacion.ejecutar")) {
    throw new ErrorDominio("PROHIBIDO", "No tienes permiso para importar datos");
  }
}

export async function listarPerfiles(actor: Actor) {
  exigirImportacion(actor);
  return getDb()
    .select({ id: importPerfiles.id, nombre: importPerfiles.nombre, mapeo: importPerfiles.mapeo })
    .from(importPerfiles)
    .orderBy(asc(importPerfiles.nombre));
}

export async function guardarPerfil(
  actor: Actor,
  entrada: { nombre: string; mapeo: Mapeo },
): Promise<{ id: string; nombre: string }> {
  exigirImportacion(actor);
  const nombre = entrada.nombre.trim();
  if (!nombre) {
    throw new ErrorDominio("VALIDACION", "El perfil necesita un nombre", {
      nombre: "Escribe un nombre",
    });
  }
  const errores = erroresDeMapeo(entrada.mapeo, esDestinoValido);
  if (errores.length > 0) {
    throw new ErrorDominio("VALIDACION", "El mapeo de columnas no es válido", {
      mapeo: errores.join("; "),
    });
  }
  const staffId = actor.tipo === "staff" ? actor.staffId : null;

  return conAuditoria(
    {
      accion: "importacion.perfil_guardar",
      actorId: actor.userId,
      targetType: "import_perfil",
      targetId: nombre,
      metadata: { nombre },
    },
    async (tx) => {
      const [fila] = await tx
        .insert(importPerfiles)
        .values({ nombre, mapeo: entrada.mapeo, creadoPor: staffId })
        .onConflictDoUpdate({
          target: importPerfiles.nombre,
          set: { mapeo: entrada.mapeo, updatedAt: new Date() },
        })
        .returning({ id: importPerfiles.id, nombre: importPerfiles.nombre });
      if (!fila) throw new ErrorDominio("VALIDACION", "No se pudo guardar el perfil");
      return fila;
    },
  );
}
