import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { log } from "@/lib/logger";
import type { Actor } from "@/server/authz/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { type Tx, conAuditoria } from "@/server/auditoria/conAuditoria";
import { getDb } from "@/server/db/client";
import { cdts, clientes, entidades, importCargas, importPerfiles } from "@/server/db/schema";
import { getStorage } from "@/server/almacenamiento/storage";
import { esDestinoValido } from "@/server/importacion/catalogo";
import { leerHoja } from "@/server/importacion/leer";
import {
  type EntidadRef,
  type FilaNormalizada,
  type Mapeo,
  erroresDeMapeo,
  normalizarFila,
} from "@/server/importacion/normalizar";
import { exigirImportacion } from "@/server/importacion/perfiles";

// Importación desde Excel (E3-T2). La vista previa normaliza sin escribir; la confirmación hace el
// upsert de clientes y cdts por bloques de 200 filas, una transacción por bloque, con auditoría por
// bloque. Las filas rechazadas van a un .xlsx descargable con la columna `motivo`.

export const TAMANO_BLOQUE = 200;
const LIMITE_FILAS_CON_ERROR = 50;

export type FilaVistaPrevia = { numero: number; errores: string[] };

async function entidadesActivas(): Promise<EntidadRef[]> {
  return getDb()
    .select({ id: entidades.id, nombre: entidades.nombre })
    .from(entidades)
    .where(eq(entidades.activa, true));
}

function validarMapeo(mapeo: Mapeo): void {
  const errores = erroresDeMapeo(mapeo, esDestinoValido);
  if (errores.length > 0) {
    throw new ErrorDominio("VALIDACION", "El mapeo de columnas no es válido", {
      mapeo: errores.join("; "),
    });
  }
}

// Encabezados de la primera hoja, para armar el mapeo de columnas. No escribe nada.
export async function encabezadosDe(actor: Actor, bytes: Uint8Array): Promise<string[]> {
  exigirImportacion(actor);
  return (await leerHoja(bytes)).encabezados;
}

// Vista previa: totales y, como máximo 50, las filas con errores (fecha inválida, entidad
// desconocida, documento vacío, etc.). No escribe nada.
export async function vistaPrevia(actor: Actor, bytes: Uint8Array, mapeo: Mapeo) {
  exigirImportacion(actor);
  validarMapeo(mapeo);
  const hoja = await leerHoja(bytes);
  const entidades = await entidadesActivas();

  let conErrores = 0;
  const filas: FilaVistaPrevia[] = [];
  for (const { numero, celdas } of hoja.filas) {
    const resultado = normalizarFila(celdas, mapeo, entidades);
    if (resultado.ok) continue;
    conErrores++;
    if (filas.length < LIMITE_FILAS_CON_ERROR) {
      filas.push({ numero, errores: resultado.errores });
    }
  }
  return {
    totalFilas: hoja.filas.length,
    validas: hoja.filas.length - conErrores,
    conErrores,
    filas,
  };
}

type Resultado = "creada" | "actualizada" | "sin_cambios";
type Aplicacion = { resultado: Resultado } | { rechazo: string };

// Aplica una fila dentro de la transacción del bloque. Primero valida el CDT (número ya usado por
// otro cliente) para no escribir a medias.
async function aplicarFila(tx: Tx, fila: FilaNormalizada): Promise<Aplicacion> {
  const [existente] = await tx
    .select()
    .from(clientes)
    .where(
      and(eq(clientes.tipoDoc, fila.cliente.tipoDoc), eq(clientes.numDoc, fila.cliente.numDoc)),
    )
    .limit(1);

  let cdtExistente: typeof cdts.$inferSelect | undefined;
  if (fila.cdt) {
    [cdtExistente] = await tx
      .select()
      .from(cdts)
      .where(and(eq(cdts.entidadId, fila.cdt.entidadId), eq(cdts.numeroCdt, fila.cdt.numeroCdt)))
      .limit(1);
    if (cdtExistente && existente && cdtExistente.clienteId !== existente.id) {
      return { rechazo: "el número de CDT ya pertenece a otro cliente" };
    }
  }

  let cambio = false;
  let creado = false;
  let clienteId: string;

  if (!existente) {
    const [nuevo] = await tx
      .insert(clientes)
      .values({
        tipoDoc: fila.cliente.tipoDoc,
        numDoc: fila.cliente.numDoc,
        nombre: fila.cliente.nombre,
        email: fila.cliente.email,
        celular: fila.cliente.celular,
        origen: "importacion",
        perfil: fila.cliente.perfil,
      })
      .returning({ id: clientes.id });
    if (!nuevo) throw new ErrorDominio("VALIDACION", "No se pudo crear el cliente");
    clienteId = nuevo.id;
    creado = true;
  } else {
    clienteId = existente.id;
    const perfilNuevo = { ...existente.perfil, ...fila.cliente.perfil };
    const celular = fila.cliente.celular ?? existente.celular;
    const cambiaPerfil = JSON.stringify(perfilNuevo) !== JSON.stringify(existente.perfil);
    const cambiaDatos =
      existente.nombre !== fila.cliente.nombre ||
      existente.email !== fila.cliente.email ||
      existente.celular !== celular;
    if (cambiaPerfil || cambiaDatos) {
      cambio = true;
      await tx
        .update(clientes)
        .set({
          nombre: fila.cliente.nombre,
          email: fila.cliente.email,
          celular,
          perfil: perfilNuevo,
          updatedAt: new Date(),
        })
        .where(eq(clientes.id, existente.id));
    }
  }

  if (fila.cdt) {
    const c = fila.cdt;
    if (!cdtExistente) {
      await tx.insert(cdts).values({
        clienteId,
        entidadId: c.entidadId,
        numeroCdt: c.numeroCdt,
        valor: c.valor,
        tasaEa: c.tasaEa,
        fechaApertura: c.fechaApertura,
        fechaVenc: c.fechaVenc,
        periodicidad: c.periodicidad,
        estado: c.estado,
        origen: "importacion",
      });
      creado = true;
    } else {
      const difiere =
        cdtExistente.clienteId !== clienteId ||
        Number(cdtExistente.valor) !== c.valor ||
        Number(cdtExistente.tasaEa) !== Number(c.tasaEa) ||
        cdtExistente.fechaApertura !== c.fechaApertura ||
        cdtExistente.fechaVenc !== c.fechaVenc ||
        cdtExistente.periodicidad !== c.periodicidad ||
        cdtExistente.estado !== c.estado;
      if (difiere) {
        cambio = true;
        await tx
          .update(cdts)
          .set({
            clienteId,
            valor: c.valor,
            tasaEa: c.tasaEa,
            fechaApertura: c.fechaApertura,
            fechaVenc: c.fechaVenc,
            periodicidad: c.periodicidad,
            estado: c.estado,
            updatedAt: new Date(),
          })
          .where(eq(cdts.id, cdtExistente.id));
      }
    }
  }

  if (creado) return { resultado: "creada" };
  if (cambio) return { resultado: "actualizada" };
  return { resultado: "sin_cambios" };
}

async function archivoDeRechazos(
  encabezados: string[],
  filas: { celdas: Record<string, unknown>; motivo: string }[],
): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Rechazos");
  hoja.addRow([...encabezados, "motivo"]);
  for (const { celdas, motivo } of filas) {
    hoja.addRow([...encabezados.map((e) => celdas[e] ?? null), motivo]);
  }
  return new Uint8Array(await libro.xlsx.writeBuffer());
}

export type ResumenImportacion = {
  cargaId: string;
  creadas: number;
  actualizadas: number;
  sinCambios: number;
  rechazadas: number;
  rechazosDisponibles: boolean;
};

export async function confirmar(
  actor: Actor,
  entrada: { bytes: Uint8Array; nombreArchivo: string; mapeo: Mapeo; perfilId: string },
): Promise<ResumenImportacion> {
  exigirImportacion(actor);
  validarMapeo(entrada.mapeo);

  const [perfil] = await getDb()
    .select({ id: importPerfiles.id })
    .from(importPerfiles)
    .where(eq(importPerfiles.id, entrada.perfilId))
    .limit(1);
  if (!perfil) throw new ErrorDominio("NO_ENCONTRADO", "El perfil de mapeo no existe");

  const hoja = await leerHoja(entrada.bytes);
  const entidades = await entidadesActivas();

  // Cada fila válida conserva sus celdas originales y su número: si luego se rechaza dentro de un
  // bloque, el archivo de rechazos sigue teniendo las columnas del Excel.
  const validas: { fila: FilaNormalizada; celdas: Record<string, unknown>; numero: number }[] = [];
  const rechazos: { celdas: Record<string, unknown>; motivo: string }[] = [];
  for (const { celdas, numero } of hoja.filas) {
    const resultado = normalizarFila(celdas, entrada.mapeo, entidades);
    if (resultado.ok) {
      validas.push({ fila: resultado.fila, celdas, numero });
    } else {
      rechazos.push({ celdas, motivo: `fila ${numero}: ${resultado.errores.join(", ")}` });
    }
  }

  const cargaId = randomUUID();
  let creadas = 0;
  let actualizadas = 0;
  let sinCambios = 0;

  for (let inicio = 0, bloque = 1; inicio < validas.length; inicio += TAMANO_BLOQUE, bloque++) {
    const lote = validas.slice(inicio, inicio + TAMANO_BLOQUE);
    // Conteos del bloque; solo se suman al total si la transacción del bloque se confirma.
    const conteo = { creadas: 0, actualizadas: 0, sinCambios: 0, rechazadas: 0 };
    await conAuditoria(
      {
        accion: "importacion.bloque",
        actorId: actor.userId,
        targetType: "import_carga",
        targetId: cargaId,
        metadata: { bloque, filas: lote.length },
      },
      async (tx) => {
        for (const { fila, celdas, numero } of lote) {
          const aplicado = await aplicarFila(tx, fila);
          if ("rechazo" in aplicado) {
            conteo.rechazadas++;
            rechazos.push({ celdas, motivo: `fila ${numero}: ${aplicado.rechazo}` });
            continue;
          }
          if (aplicado.resultado === "creada") conteo.creadas++;
          else if (aplicado.resultado === "actualizada") conteo.actualizadas++;
          else conteo.sinCambios++;
        }
        return conteo;
      },
    );
    creadas += conteo.creadas;
    actualizadas += conteo.actualizadas;
    sinCambios += conteo.sinCambios;
  }

  const rechazadas = rechazos.length;
  await conAuditoria(
    {
      accion: "importacion.confirmar",
      actorId: actor.userId,
      targetType: "import_carga",
      targetId: cargaId,
      metadata: { archivo: entrada.nombreArchivo, creadas, actualizadas, sinCambios, rechazadas },
    },
    async (tx) => {
      await tx.insert(importCargas).values({
        id: cargaId,
        perfilId: entrada.perfilId,
        archivoNombre: entrada.nombreArchivo,
        filasCreadas: creadas,
        filasActualizadas: actualizadas,
        filasSinCambios: sinCambios,
        filasRechazadas: rechazadas,
        actorUserId: actor.userId,
      });
    },
  );

  // Efecto externo: después del commit. Si falla, la carga queda registrada sin archivo de rechazos.
  let rechazosDisponibles = false;
  if (rechazadas > 0) {
    try {
      const clave = `importaciones/${cargaId}/rechazos.xlsx`;
      const bytes = await archivoDeRechazos(hoja.encabezados, rechazos);
      await getStorage().put(clave, bytes);
      await getDb()
        .update(importCargas)
        .set({ rechazosStoragePath: clave })
        .where(eq(importCargas.id, cargaId));
      rechazosDisponibles = true;
    } catch (error) {
      log.error("no se pudo guardar el archivo de rechazos de la importación", {
        cargaId,
        causa: error instanceof Error ? error.name : "desconocida",
      });
    }
  }

  return { cargaId, creadas, actualizadas, sinCambios, rechazadas, rechazosDisponibles };
}

// Archivo de rechazos de una carga, para descargar. Solo quien puede importar.
export async function rechazosDe(actor: Actor, cargaId: string) {
  exigirImportacion(actor);
  const [carga] = await getDb()
    .select({ ruta: importCargas.rechazosStoragePath })
    .from(importCargas)
    .where(eq(importCargas.id, cargaId))
    .limit(1);
  if (!carga?.ruta) throw new ErrorDominio("NO_ENCONTRADO", "La carga no tiene rechazos");
  return { nombre: `rechazos-${cargaId}.xlsx`, bytes: await getStorage().get(carga.ruta) };
}
