import { describe, expect, it } from "vitest";
import {
  type EntidadMotor,
  type FilaCondicion,
  calcularCondiciones,
} from "@/server/condiciones/motor";
import { formatoMiles, tasaTexto, valorEnLetras } from "@/server/condiciones/en-letras";

// Tablas fijas de docs/referencia/contratos.md §4 (escritas aquí, no importadas).
const CALENDARIO: EntidadMotor = {
  id: "ent-cal",
  montoMinimo: 0,
  baseCalculo: "calendario",
  ajusteNoHabil: "ninguno",
};
const COMERCIAL: EntidadMotor = {
  id: "ent-com",
  montoMinimo: 0,
  baseCalculo: "comercial_360",
  ajusteNoHabil: "ninguno",
};

function fila(
  entidadId: string,
  plazoDias: number,
  extra: Partial<FilaCondicion> = {},
): FilaCondicion {
  return {
    id: `cond-${entidadId}-${plazoDias}`,
    entidadId,
    plazoDias,
    montoMin: 0,
    montoMax: null,
    periodicidad: "vencimiento",
    tasaEa: "10.5000",
    vigenteDesde: "2026-01-01",
    vigenteHasta: null,
    ...extra,
  };
}

function venc(
  entidad: EntidadMotor,
  apertura: string,
  plazo: number,
  festivos: string[] = [],
): string | undefined {
  const resultado = calcularCondiciones({
    entidad: { ...entidad, ajusteNoHabil: entidad.ajusteNoHabil },
    filas: [fila(entidad.id, plazo)],
    festivos,
    valor: 50_000_000,
    plazoDias: plazo,
    periodicidad: "vencimiento",
    fechaApertura: apertura,
  });
  return resultado.ok ? resultado.fechaVenc : undefined;
}

describe("fechas de vencimiento (contratos.md §4, casos fijos)", () => {
  it("1. calendario, ninguno: 2026-03-02 + 90 = 2026-05-31", () => {
    expect(venc(CALENDARIO, "2026-03-02", 90)).toBe("2026-05-31");
  });
  it("2. calendario, siguiente hábil: 2026-05-31 (domingo) pasa a 2026-06-01", () => {
    const entidad = { ...CALENDARIO, ajusteNoHabil: "siguiente_habil" as const };
    expect(venc(entidad, "2026-03-02", 90)).toBe("2026-06-01");
  });
  it("3. calendario, anterior hábil: 2026-05-31 (domingo) pasa a 2026-05-29", () => {
    const entidad = { ...CALENDARIO, ajusteNoHabil: "anterior_habil" as const };
    expect(venc(entidad, "2026-03-02", 90)).toBe("2026-05-29");
  });
  it("4. calendario, siguiente hábil con festivo el 2026-06-01: pasa a 2026-06-02", () => {
    const entidad = { ...CALENDARIO, ajusteNoHabil: "siguiente_habil" as const };
    expect(venc(entidad, "2026-03-02", 90, ["2026-06-01"])).toBe("2026-06-02");
  });
  it("5. comercial 360, ninguno: 2026-01-31 + 30 días comerciales = 2026-02-28", () => {
    expect(venc(COMERCIAL, "2026-01-31", 30)).toBe("2026-02-28");
  });
  it("6. comercial 360, siguiente hábil: 2026-02-28 (sábado) pasa a 2026-03-02", () => {
    const entidad = { ...COMERCIAL, ajusteNoHabil: "siguiente_habil" as const };
    expect(venc(entidad, "2026-01-31", 30)).toBe("2026-03-02");
  });
  it("7. comercial 360, ninguno: 2026-01-15 + 45 = 2026-03-02", () => {
    expect(venc(COMERCIAL, "2026-01-15", 45)).toBe("2026-03-02");
  });
});

describe("plazoMeses (contratos.md §4)", () => {
  const casos: [number, number][] = [
    [90, 3],
    [45, 2],
    [100, 3],
    [180, 6],
  ];
  for (const [plazo, meses] of casos) {
    it(`plazoDias ${plazo} → plazoMeses ${meses}`, () => {
      const resultado = calcularCondiciones({
        entidad: CALENDARIO,
        filas: [fila(CALENDARIO.id, plazo)],
        festivos: [],
        valor: 50_000_000,
        plazoDias: plazo,
        periodicidad: "vencimiento",
        fechaApertura: "2026-03-02",
      });
      expect(resultado.ok && resultado.plazoMeses).toBe(meses);
    });
  }
});

describe("valorEnLetras (contratos.md §4)", () => {
  const casos: [number, string][] = [
    [50_000_000, "CINCUENTA MILLONES DE PESOS M/CTE"],
    [1_234_567, "UN MILLÓN DOSCIENTOS TREINTA Y CUATRO MIL QUINIENTOS SESENTA Y SIETE PESOS M/CTE"],
    [21_000_000, "VEINTIÚN MILLONES DE PESOS M/CTE"],
    [101_000, "CIENTO UN MIL PESOS M/CTE"],
    [1_000, "MIL PESOS M/CTE"],
    [100, "CIEN PESOS M/CTE"],
    [0, ""],
  ];
  for (const [valor, texto] of casos) {
    it(`${valor} → "${texto}"`, () => {
      expect(valorEnLetras(valor)).toBe(texto);
    });
  }
});

describe("formatoMiles y tasaTexto (contratos.md §4)", () => {
  it("formatoMiles(50000000) = 50.000.000 y formatoMiles(0) = vacío", () => {
    expect(formatoMiles(50_000_000)).toBe("50.000.000");
    expect(formatoMiles(0)).toBe("");
  });
  it("tasaTexto(10.5000) = 10,50", () => {
    expect(tasaTexto("10.5000")).toBe("10,50");
  });
});

describe("errores del motor (criterios 2 y 3)", () => {
  const base = {
    entidad: CALENDARIO,
    festivos: [],
    valor: 50_000_000,
    plazoDias: 90,
    periodicidad: "vencimiento",
    fechaApertura: "2026-03-02",
  };

  it("sin filas aplicables → SIN_CONDICION", () => {
    expect(calcularCondiciones({ ...base, filas: [] })).toEqual({
      ok: false,
      error: "SIN_CONDICION",
    });
  });

  it("dos filas que aplican → CONDICION_AMBIGUA", () => {
    const filas = [fila(CALENDARIO.id, 90, { id: "a" }), fila(CALENDARIO.id, 90, { id: "b" })];
    expect(calcularCondiciones({ ...base, filas })).toEqual({
      ok: false,
      error: "CONDICION_AMBIGUA",
    });
  });

  it("valor menor que el monto mínimo de la entidad → MONTO_MINIMO", () => {
    const entidad = { ...CALENDARIO, montoMinimo: 60_000_000 };
    expect(calcularCondiciones({ ...base, entidad, filas: [fila(CALENDARIO.id, 90)] })).toEqual({
      ok: false,
      error: "MONTO_MINIMO",
    });
  });
});
