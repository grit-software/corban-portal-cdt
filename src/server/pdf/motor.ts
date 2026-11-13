import { readFileSync } from "node:fs";
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  StandardFonts,
  type PDFForm,
} from "pdf-lib";
import { type DatosPdf, dinero } from "./derivar.ts";
import {
  type DocKey,
  type FilaMapeo,
  cargarMapeo,
  caracterEn,
  limpiar,
  mismo,
  rutaPlantilla,
} from "./mapeo.ts";

// Motor PDF (contratos.md §5). Orden exacto: cargar → deduplicar widgets → limpiar valores de
// fábrica → aplicar mapeo → updateFieldAppearances(Helvetica) → guardar.

export type ReportePdf = { notFound: string[]; skipped: string[]; text: number; checks: number };

export async function generarPdf(
  docKey: DocKey,
  D: DatosPdf,
): Promise<{ bytes: Uint8Array; reporte: ReportePdf }> {
  const pdf = await PDFDocument.load(readFileSync(rutaPlantilla(docKey)), {
    ignoreEncryption: true,
  });
  const form = pdf.getForm();
  deduplicarWidgets(pdf, form);

  const porNombre = new Map(form.getFields().map((campo) => [campo.getName(), campo]));
  const reporte: ReportePdf = { notFound: [], skipped: [], text: 0, checks: 0 };

  // Limpieza: el PDF trae valores de fábrica que no deben salir.
  for (const campo of porNombre.values()) {
    try {
      if (campo instanceof PDFTextField) campo.setText(undefined);
      else if (campo instanceof PDFCheckBox) campo.uncheck();
      else if (
        campo instanceof PDFRadioGroup ||
        campo instanceof PDFDropdown ||
        campo instanceof PDFOptionList
      ) {
        campo.clear();
      }
    } catch {
      // campo sin valor que limpiar
    }
  }

  for (const fila of cargarMapeo(docKey)) {
    aplicarFila(fila, D, porNombre, reporte);
  }

  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  form.updateFieldAppearances(fuente);
  const bytes = await pdf.save();
  return { bytes, reporte };
}

function aplicarFila(
  fila: FilaMapeo,
  D: DatosPdf,
  campos: Map<string, ReturnType<PDFForm["getFields"]>[number]>,
  reporte: ReportePdf,
): void {
  switch (fila.k) {
    case "t":
      escribirTexto(
        fila.f,
        fila.fmt === "money" ? dinero(D[fila.key ?? ""]) : String(D[fila.key ?? ""] ?? ""),
        campos,
        reporte,
      );
      return;
    case "d":
      escribirTexto(
        fila.f,
        fechaParte(String(D[fila.key ?? ""] ?? ""), fila.part),
        campos,
        reporte,
      );
      return;
    case "c":
      if (D[fila.key ?? ""] && mismo(D[fila.key ?? ""], fila.val ?? ""))
        marcar(fila.f, campos, reporte);
      return;
    case "x":
      marcar(fila.f, campos, reporte);
      return;
    case "s":
      escribirTexto(fila.f, fila.val ?? "", campos, reporte);
      return;
    case "tv": {
      const [clave, esperado] = fila.cond ?? ["", ""];
      if (D[clave] === esperado) {
        const valor =
          fila.fmt === "money" ? dinero(D[fila.key ?? ""]) : String(D[fila.key ?? ""] ?? "");
        escribirTexto(fila.f, valor, campos, reporte);
      }
      return;
    }
    case "ch":
      escribirTexto(fila.f, caracterEn(D[fila.key ?? ""], fila.i ?? 0), campos, reporte);
      return;
  }
}

function escribirTexto(
  nombre: string,
  valor: string,
  campos: Map<string, ReturnType<PDFForm["getFields"]>[number]>,
  reporte: ReportePdf,
): void {
  const campo = campos.get(nombre);
  if (!campo) {
    reporte.notFound.push(nombre);
    return;
  }
  if (valor === "") return;
  if (campo instanceof PDFTextField) {
    campo.setText(limpiar(valor));
    reporte.text++;
  } else {
    reporte.skipped.push(`${nombre} (no es texto)`);
  }
}

function marcar(
  nombre: string,
  campos: Map<string, ReturnType<PDFForm["getFields"]>[number]>,
  reporte: ReportePdf,
): void {
  const campo = campos.get(nombre);
  if (!campo) {
    reporte.notFound.push(nombre);
    return;
  }
  if (campo instanceof PDFCheckBox) {
    campo.check();
    reporte.checks++;
  } else if (campo instanceof PDFRadioGroup) {
    const opciones = campo.getOptions();
    const primera = opciones[0];
    if (primera !== undefined) {
      campo.select(primera);
      reporte.checks++;
    }
  } else if (campo instanceof PDFTextField) {
    campo.setText("X");
    reporte.checks++;
  } else {
    reporte.skipped.push(`${nombre} (no es casilla)`);
  }
}

function fechaParte(iso: string, parte: string | undefined): string {
  if (!iso) return "";
  const [anio = "", mes = "", dia = ""] = iso.split("-");
  if (parte === "d") return dia;
  if (parte === "m") return mes;
  if (parte === "y") return anio;
  return `${dia}/${mes}/${anio}`;
}

// Algunos PDF traen dos widgets casi idénticos para el mismo campo de texto: al rellenar se ve
// el texto doble. Se quita el widget duplicado (todas las coordenadas a menos de 3 pt).
function deduplicarWidgets(pdf: PDFDocument, form: PDFForm): void {
  for (const campo of form.getFields()) {
    if (!(campo instanceof PDFTextField)) continue;
    const acroCampo = campo.acroField;
    const widgets = acroCampo.getWidgets();
    if (widgets.length < 2) continue;
    const kids = acroCampo.Kids();
    for (let i = widgets.length - 1; i >= 1; i--) {
      const r = widgets[i]?.getRectangle();
      if (!r) continue;
      for (let j = 0; j < i; j++) {
        const q = widgets[j]?.getRectangle();
        if (!q) continue;
        const iguales =
          Math.abs(r.x - q.x) < 3 &&
          Math.abs(r.y - q.y) < 3 &&
          Math.abs(r.width - q.width) < 3 &&
          Math.abs(r.height - q.height) < 3;
        if (iguales) {
          const referencia = String(kids?.get(i));
          for (const pagina of pdf.getPages()) {
            const anotaciones = pagina.node.Annots();
            if (!anotaciones) continue;
            for (let k = anotaciones.size() - 1; k >= 0; k--) {
              if (String(anotaciones.get(k)) === referencia) anotaciones.remove(k);
            }
          }
          acroCampo.removeWidget(i);
          break;
        }
      }
    }
  }
}
