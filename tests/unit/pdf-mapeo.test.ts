import { describe, expect, it } from "vitest";
import { DOC_KEYS, cargarMapeo, caracterEn, limpiar, mismo } from "@/server/pdf/mapeo";

// Reglas de las filas del mapeo (contratos.md §5), probadas sin abrir PDF.

describe("fila «ch»: carácter por índice", () => {
  it("el índice 2 de 12345678901 es 3", () => {
    expect(caracterEn("12345678901", 2)).toBe("3");
  });
  it("un índice fuera de rango deja el campo vacío", () => {
    expect(caracterEn("123", 7)).toBe("");
  });
});

describe("fila «c»: comparación con mismo()", () => {
  it("soltero coincide con Soltera (mayúsculas y o final ≡ a)", () => {
    expect(mismo("soltero", "Soltera")).toBe(true);
  });
  it("si coincide con Sí (tildes)", () => {
    expect(mismo("si", "Sí")).toBe(true);
  });
  it("valores distintos no coinciden", () => {
    expect(mismo("casado", "soltera")).toBe(false);
  });
  it("un valor vacío no coincide con nada", () => {
    expect(mismo("", "si")).toBe(false);
  });
});

describe("texto para Helvetica", () => {
  it("deja Latin-1 y cambia lo demás por ?", () => {
    expect(limpiar("Peñaloza ✓")).toBe("Peñaloza ?");
  });
});

describe("mapeo por documento", () => {
  for (const docKey of DOC_KEYS) {
    it(`${docKey} tiene filas de mapeo`, () => {
      expect(cargarMapeo(docKey).length).toBeGreaterThan(0);
    });
  }
  it("ban_orden incluye las filas de cuenta de pago", () => {
    expect(cargarMapeo("ban_orden").some((f) => f.k === "ch")).toBe(true);
  });
});
