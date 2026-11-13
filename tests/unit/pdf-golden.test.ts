import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from "pdf-lib";
import { describe, expect, it } from "vitest";
import { derivarDatosPdf } from "@/server/pdf/derivar";
import { generarPdf } from "@/server/pdf/motor";
import { DOC_KEYS, type DocKey, cargarMapeo } from "@/server/pdf/mapeo";

// Pruebas golden de los seis formatos (contratos.md §5 y §7). El fixture es el de §7; los PDF
// generados se guardan en .data/golden para revisarlos a mano antes de commitear snapshots.

const fixture = JSON.parse(
  readFileSync(path.resolve("tests/fixtures/cliente-ejemplo.json"), "utf8"),
) as { congelado: Parameters<typeof derivarDatosPdf>[1]; datos: Record<string, string> };

const CARPETA_REVISION = path.resolve(".data/golden");

async function generar(docKey: DocKey) {
  const D = derivarDatosPdf(fixture.datos, fixture.congelado);
  const { bytes, reporte } = await generarPdf(docKey, D);
  mkdirSync(CARPETA_REVISION, { recursive: true });
  writeFileSync(path.join(CARPETA_REVISION, `${docKey}.pdf`), bytes);
  return { bytes, reporte };
}

// Valor de cada campo mapeado: texto, «marcado» o la opción elegida.
function valoresMapeados(form: ReturnType<PDFDocument["getForm"]>, nombres: string[]) {
  const valores: Record<string, string> = {};
  for (const nombre of [...new Set(nombres)].sort()) {
    const campo = form.getField(nombre);
    valores[nombre] = valorDe(campo);
  }
  return valores;
}

function valorDe(
  campo: ReturnType<ReturnType<PDFDocument["getForm"]>["getFields"]>[number],
): string {
  if (campo instanceof PDFTextField) return campo.getText() ?? "";
  if (campo instanceof PDFCheckBox) return campo.isChecked() ? "marcado" : "";
  if (campo instanceof PDFRadioGroup) return campo.getSelected() ?? "";
  if (campo instanceof PDFDropdown || campo instanceof PDFOptionList)
    return campo.getSelected().join(",");
  return "";
}

describe.each(DOC_KEYS)("PDF golden: %s", (docKey) => {
  const nombresMapeados = cargarMapeo(docKey).map((f) => f.f);

  it("criterio 1: genera el documento y el reporte no tiene notFound", async () => {
    const { reporte } = await generar(docKey);
    expect(reporte.notFound).toEqual([]);
  });

  it("criterio 2: los campos mapeados coinciden con el snapshot commiteado", async () => {
    const { bytes } = await generar(docKey);
    const form = (await PDFDocument.load(bytes)).getForm();
    const json = `${JSON.stringify(valoresMapeados(form, nombresMapeados), null, 2)}\n`;
    await expect(json).toMatchFileSnapshot(`./__snapshots__/pdf-${docKey}.json`);
  });

  it("criterio 3: los campos sin mapeo quedan vacíos", async () => {
    const { bytes } = await generar(docKey);
    const form = (await PDFDocument.load(bytes)).getForm();
    const mapeados = new Set(nombresMapeados);
    for (const campo of form.getFields()) {
      if (mapeados.has(campo.getName())) continue;
      expect(valorDe(campo), campo.getName()).toBe("");
    }
  });

  it("criterio 4: ningún campo de texto tiene dos widgets a menos de 3 pt", async () => {
    const { bytes } = await generar(docKey);
    const form = (await PDFDocument.load(bytes)).getForm();
    for (const campo of form.getFields()) {
      if (!(campo instanceof PDFTextField)) continue;
      const widgets = campo.acroField.getWidgets().map((w) => w.getRectangle());
      for (let i = 0; i < widgets.length; i++) {
        for (let j = i + 1; j < widgets.length; j++) {
          const a = widgets[i];
          const b = widgets[j];
          if (!a || !b) continue;
          const cerca =
            Math.abs(a.x - b.x) < 3 &&
            Math.abs(a.y - b.y) < 3 &&
            Math.abs(a.width - b.width) < 3 &&
            Math.abs(a.height - b.height) < 3;
          expect(cerca, `${campo.getName()} tiene widgets duplicados`).toBe(false);
        }
      }
    }
  });
});
