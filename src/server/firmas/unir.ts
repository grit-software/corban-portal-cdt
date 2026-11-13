import { PDFDocument } from "pdf-lib";
import type { TipoArchivo } from "./tipo.ts";

// A4 en puntos y margen de 24 pt alrededor de cada imagen (contrato de la epic).
const A4_ANCHO = 595.28;
const A4_ALTO = 841.89;
const MARGEN = 24;

export type ArchivoFirmado = { bytes: Uint8Array; tipo: TipoArchivo };

// Un solo PDF se guarda tal cual. Imágenes (o una mezcla) forman un PDF nuevo: una página A4
// por imagen, escalada y centrada; las páginas de los PDF se copian en el orden recibido.
export async function unirEnPdf(archivos: ArchivoFirmado[]): Promise<Uint8Array> {
  const primero = archivos[0];
  if (archivos.length === 1 && primero?.tipo === "pdf") {
    return primero.bytes;
  }

  const salida = await PDFDocument.create();
  for (const archivo of archivos) {
    if (archivo.tipo === "pdf") {
      const origen = await PDFDocument.load(archivo.bytes, { ignoreEncryption: true });
      const paginas = await salida.copyPages(origen, origen.getPageIndices());
      for (const pagina of paginas) salida.addPage(pagina);
      continue;
    }
    const imagen =
      archivo.tipo === "jpeg"
        ? await salida.embedJpg(archivo.bytes)
        : await salida.embedPng(archivo.bytes);
    const pagina = salida.addPage([A4_ANCHO, A4_ALTO]);
    const escala = Math.min(
      (A4_ANCHO - 2 * MARGEN) / imagen.width,
      (A4_ALTO - 2 * MARGEN) / imagen.height,
    );
    const ancho = imagen.width * escala;
    const alto = imagen.height * escala;
    pagina.drawImage(imagen, {
      x: (A4_ANCHO - ancho) / 2,
      y: (A4_ALTO - alto) / 2,
      width: ancho,
      height: alto,
    });
  }
  return salida.save();
}
