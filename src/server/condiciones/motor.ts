import { valorEnLetras } from "./en-letras.ts";

// Motor de cálculo PURO (docs/referencia/contratos.md §4). Sin base de datos, sin Intl, sin
// hora local: todo el aritmética de fechas es UTC sobre cadenas yyyy-mm-dd.

export type EntidadMotor = {
  id: string;
  montoMinimo: number;
  baseCalculo: "calendario" | "comercial_360";
  ajusteNoHabil: "siguiente_habil" | "anterior_habil" | "ninguno";
};

export type FilaCondicion = {
  id: string;
  entidadId: string;
  plazoDias: number;
  montoMin: number;
  montoMax: number | null;
  periodicidad: string;
  tasaEa: string;
  vigenteDesde: string;
  vigenteHasta: string | null;
};

export type EntradaMotor = {
  entidad: EntidadMotor;
  filas: FilaCondicion[];
  festivos: string[];
  valor: number;
  plazoDias: number;
  periodicidad: string;
  fechaApertura: string;
};

export type ErrorMotor = "MONTO_MINIMO" | "SIN_CONDICION" | "CONDICION_AMBIGUA";

export type ResultadoMotor =
  | {
      ok: true;
      condicionId: string;
      tasaEa: string;
      fechaVenc: string;
      plazoMeses: number;
      plazoTxt: string;
      valorLetras: string;
    }
  | { ok: false; error: ErrorMotor };

const MS_DIA = 86_400_000;

function aFecha(iso: string): Date {
  const [anio = 0, mes = 1, dia = 1] = iso.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

function sumarDias(fecha: Date, dias: number): Date {
  return new Date(fecha.getTime() + dias * MS_DIA);
}

// Suma meses con tope a fin de mes: 31-ene + 1 mes = 28/29-feb.
function sumarMeses(fecha: Date, meses: number): Date {
  const primero = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth() + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const dia = Math.min(fecha.getUTCDate(), ultimoDia);
  return new Date(Date.UTC(primero.getUTCFullYear(), primero.getUTCMonth(), dia));
}

function vencimientoBase(
  apertura: string,
  plazoDias: number,
  base: EntidadMotor["baseCalculo"],
): Date {
  const inicio = aFecha(apertura);
  if (base === "calendario") {
    return sumarDias(inicio, plazoDias);
  }
  const meses = Math.floor(plazoDias / 30);
  const dias = plazoDias % 30;
  return sumarDias(sumarMeses(inicio, meses), dias);
}

function esHabil(fecha: Date, festivos: Set<string>): boolean {
  const dia = fecha.getUTCDay();
  return dia !== 0 && dia !== 6 && !festivos.has(aIso(fecha));
}

function ajustarNoHabil(
  fecha: Date,
  regla: EntidadMotor["ajusteNoHabil"],
  festivos: Set<string>,
): Date {
  if (regla === "ninguno") {
    return fecha;
  }
  const paso = regla === "siguiente_habil" ? 1 : -1;
  let actual = fecha;
  while (!esHabil(actual, festivos)) {
    actual = sumarDias(actual, paso);
  }
  return actual;
}

export function calcularCondiciones(entrada: EntradaMotor): ResultadoMotor {
  if (entrada.valor < entrada.entidad.montoMinimo) {
    return { ok: false, error: "MONTO_MINIMO" };
  }

  const aplicables = entrada.filas.filter(
    (fila) =>
      fila.entidadId === entrada.entidad.id &&
      fila.plazoDias === entrada.plazoDias &&
      fila.periodicidad === entrada.periodicidad &&
      fila.montoMin <= entrada.valor &&
      (fila.montoMax === null || entrada.valor <= fila.montoMax) &&
      fila.vigenteDesde <= entrada.fechaApertura &&
      (fila.vigenteHasta === null || entrada.fechaApertura <= fila.vigenteHasta),
  );
  if (aplicables.length === 0) {
    return { ok: false, error: "SIN_CONDICION" };
  }
  if (aplicables.length > 1) {
    return { ok: false, error: "CONDICION_AMBIGUA" };
  }
  const fila = aplicables[0];
  if (!fila) {
    return { ok: false, error: "SIN_CONDICION" };
  }

  const base = vencimientoBase(
    entrada.fechaApertura,
    entrada.plazoDias,
    entrada.entidad.baseCalculo,
  );
  const fechaVenc = ajustarNoHabil(base, entrada.entidad.ajusteNoHabil, new Set(entrada.festivos));
  return {
    ok: true,
    condicionId: fila.id,
    tasaEa: fila.tasaEa,
    fechaVenc: aIso(fechaVenc),
    plazoMeses: Math.round(entrada.plazoDias / 30),
    plazoTxt: `${entrada.plazoDias} días`,
    valorLetras: valorEnLetras(entrada.valor),
  };
}
