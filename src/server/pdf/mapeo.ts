import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// Mapeo de campos PDF (contratos.md §5). Los archivos mapping*.json y los PDF se editan solo
// con su proceso (CLAUDE.md, regla 6); aquí solo se leen.

export const DOC_KEYS = [
  "ban_vinc",
  "ban_orden",
  "colte_vinc",
  "colte_cdt",
  "juris",
  "mmujer",
] as const;
export type DocKey = (typeof DOC_KEYS)[number];

export type FilaMapeo = {
  f: string;
  k: "t" | "d" | "c" | "x" | "s" | "tv" | "ch";
  key?: string;
  val?: string;
  part?: string;
  fmt?: string;
  cond?: [string, string];
  i?: number;
};

const CARPETA = path.join(process.cwd(), "assets", "formatos");

export function rutaPlantilla(docKey: DocKey): string {
  return path.join(CARPETA, `${docKey}.pdf`);
}

// Filas de mapping.json y, si existen, las de mapping.cuenta-pago.json para ese documento.
export function cargarMapeo(docKey: DocKey): FilaMapeo[] {
  const principal = JSON.parse(readFileSync(path.join(CARPETA, "mapping.json"), "utf8")) as Record<
    string,
    FilaMapeo[]
  >;
  const cuentaPath = path.join(CARPETA, "mapping.cuenta-pago.json");
  const cuenta = existsSync(cuentaPath)
    ? (JSON.parse(readFileSync(cuentaPath, "utf8")) as Record<string, FilaMapeo[]>)
    : {};
  return [...(principal[docKey] ?? []), ...(cuenta[docKey] ?? [])];
}

// Igualdad de la fila «c»: sin mayúsculas, sin tildes, con la o final tratada como a.
export function mismo(a: unknown, b: string): boolean {
  const normaliza = (v: string) =>
    v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/o$/, "a");
  return normaliza(a === null || a === undefined ? "" : String(a)) === normaliza(b);
}

// Texto que Helvetica (WinAnsi) puede dibujar: lo que no está en Latin-1 se cambia por «?».
export function limpiar(valor: unknown): string {
  return [...String(valor ?? "")]
    .map((caracter) => ((caracter.codePointAt(0) ?? 0) > 255 ? "?" : caracter))
    .join("");
}

// Fila «ch»: el carácter i de un valor. Fuera de rango, vacío.
export function caracterEn(valor: unknown, indice: number): string {
  return String(valor ?? "").charAt(indice);
}
