import ExcelJS from "exceljs";
import { ErrorDominio } from "@/server/authz/errores";

// Lectura de la primera hoja: fila 1 = encabezados. Las celdas con fórmula o texto enriquecido se
// reducen a su valor. Las filas completamente vacías se descartan.

export type FilaLeida = { numero: number; celdas: Record<string, unknown> };
export type HojaLeida = { encabezados: string[]; filas: FilaLeida[] };

function valorCelda(valor: unknown): unknown {
  if (valor && typeof valor === "object") {
    if ("result" in valor) return (valor as { result?: unknown }).result;
    if ("richText" in valor) {
      return (valor as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
    }
    if ("text" in valor) return (valor as { text?: unknown }).text;
  }
  return valor;
}

export async function leerHoja(bytes: Uint8Array): Promise<HojaLeida> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(bytes.slice().buffer as ArrayBuffer);
  } catch {
    throw new ErrorDominio("VALIDACION", "El archivo no es un .xlsx válido", {
      archivo: "No se pudo leer el archivo",
    });
  }
  const hoja = libro.worksheets[0];
  if (!hoja) {
    throw new ErrorDominio("VALIDACION", "El archivo no tiene hojas", {
      archivo: "El archivo está vacío",
    });
  }

  const encabezados: string[] = [];
  const filaEncabezado = hoja.getRow(1);
  for (let col = 1; col <= filaEncabezado.cellCount; col++) {
    encabezados.push(String(valorCelda(filaEncabezado.getCell(col).value) ?? "").trim());
  }

  const filas: FilaLeida[] = [];
  for (let numero = 2; numero <= hoja.rowCount; numero++) {
    const fila = hoja.getRow(numero);
    const celdas: Record<string, unknown> = {};
    let vacia = true;
    encabezados.forEach((encabezado, indice) => {
      if (!encabezado) return;
      const valor = valorCelda(fila.getCell(indice + 1).value);
      if (valor !== null && valor !== undefined && String(valor).trim() !== "") vacia = false;
      celdas[encabezado] = valor;
    });
    if (!vacia) filas.push({ numero, celdas });
  }

  return { encabezados: encabezados.filter(Boolean), filas };
}
