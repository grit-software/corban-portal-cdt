import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { ErrorDominio } from "@/server/authz/errores";
import { conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { clientes } from "@/server/db/schema";
import type { DatosRegistro } from "./esquemas.ts";

// Registro público de cliente. Mismo documento y mismo correo sin usuario → no duplica.
// Mismo documento con otro correo → DOCUMENTO_REGISTRADO.
export async function registrarCliente(
  datos: DatosRegistro,
): Promise<{ id: string; creado: boolean }> {
  const db = getDb();
  const [existente] = await db
    .select({ id: clientes.id, email: clientes.email })
    .from(clientes)
    .where(and(eq(clientes.tipoDoc, datos.tipoDoc), eq(clientes.numDoc, datos.numDoc)))
    .limit(1);
  if (existente) {
    if (existente.email.toLowerCase() === datos.email) {
      return { id: existente.id, creado: false };
    }
    throw new ErrorDominio(
      "DOCUMENTO_REGISTRADO",
      "Ya existe un registro con ese documento. Ingresa con el correo que usaste.",
    );
  }

  const id = randomUUID();
  try {
    await conAuditoria(
      {
        accion: "cliente.registrar",
        actorId: null,
        targetType: "cliente",
        targetId: id,
        metadata: { origen: "registro" },
      },
      async (tx) => {
        await tx.insert(clientes).values({
          id,
          tipoDoc: datos.tipoDoc,
          numDoc: datos.numDoc,
          email: datos.email,
          nombre: datos.nombre,
          celular: datos.celular ?? null,
          origen: "registro",
        });
      },
    );
  } catch (error) {
    // Dos registros simultáneos del mismo documento: el índice único decide.
    const envuelto = error as { cause?: { code?: string }; code?: string };
    if ((envuelto.cause ?? envuelto).code === "23505") {
      throw new ErrorDominio("DOCUMENTO_REGISTRADO", "Ya existe un registro con ese documento");
    }
    throw error;
  }
  return { id, creado: true };
}
