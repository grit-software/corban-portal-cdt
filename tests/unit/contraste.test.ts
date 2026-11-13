import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contraste WCAG de los pares texto/fondo del sistema de diseño. Lee los colores reales de
// src/app/globals.css (@theme), no copias: si cambia la paleta, la prueba cambia con ella.
const css = readFileSync(path.resolve("src/app/globals.css"), "utf8");

function colorDe(nombre: string): string {
  const coincidencia = new RegExp(`--color-${nombre}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!coincidencia?.[1]) {
    throw new Error(`Falta el token --color-${nombre} en globals.css`);
  }
  return coincidencia[1];
}

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = canales;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x) as [number, number];
  return (claro + 0.05) / (oscuro + 0.05);
}

// [texto, fondo] tal como se usan en la interfaz.
const PARES: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["primary", "background"],
  ["primary", "card"],
  ["primary-foreground", "primary"],
  ["primary-foreground", "primary-dark"],
  ["card", "navy"],
  ["destructive", "background"],
  ["destructive", "card"],
  ["destructive-foreground", "destructive"],
  ["success-strong", "card"],
  ["success-strong", "background"],
  ["card", "success-strong"],
  ["secondary-foreground", "secondary"],
];

describe("contraste de los pares texto/fondo (WCAG ≥ 4,5)", () => {
  for (const [texto, fondo] of PARES) {
    it(`${texto} sobre ${fondo}`, () => {
      const razon = contraste(colorDe(texto), colorDe(fondo));
      expect(razon, `${texto} sobre ${fondo} = ${razon.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
