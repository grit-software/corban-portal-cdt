// Port literal de enLetras / valorEnLetras del POC (docs/referencia/contratos.md §4).
// Sin Intl: el formato no depende de los datos ICU del runtime.

const U = [
  "",
  "UN",
  "DOS",
  "TRES",
  "CUATRO",
  "CINCO",
  "SEIS",
  "SIETE",
  "OCHO",
  "NUEVE",
  "DIEZ",
  "ONCE",
  "DOCE",
  "TRECE",
  "CATORCE",
  "QUINCE",
  "DIECISÉIS",
  "DIECISIETE",
  "DIECIOCHO",
  "DIECINUEVE",
  "VEINTE",
  "VEINTIÚN",
  "VEINTIDÓS",
  "VEINTITRÉS",
  "VEINTICUATRO",
  "VEINTICINCO",
  "VEINTISÉIS",
  "VEINTISIETE",
  "VEINTIOCHO",
  "VEINTINUEVE",
];
const DEC = [
  "",
  "",
  "",
  "TREINTA",
  "CUARENTA",
  "CINCUENTA",
  "SESENTA",
  "SETENTA",
  "OCHENTA",
  "NOVENTA",
];
const CEN = [
  "",
  "CIENTO",
  "DOSCIENTOS",
  "TRESCIENTOS",
  "CUATROCIENTOS",
  "QUINIENTOS",
  "SEISCIENTOS",
  "SETECIENTOS",
  "OCHOCIENTOS",
  "NOVECIENTOS",
];

function menorMil(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const r = n % 100;
  let s = c ? CEN[c] : "";
  if (r) {
    if (s) s += " ";
    if (r < 30) s += U[r];
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      s += DEC[d] + (u ? ` Y ${U[u]}` : "");
    }
  }
  return s;
}

function bajoMillon(n: number): string {
  const miles = Math.floor(n / 1000);
  const r = n % 1000;
  const partes: string[] = [];
  if (miles) partes.push(miles === 1 ? "MIL" : `${menorMil(miles)} MIL`);
  if (r) partes.push(menorMil(r));
  return partes.join(" ");
}

export function enLetras(n: number): string {
  if (!n || n >= 1e12) return "";
  const mm = Math.floor(n / 1e6);
  const resto = n % 1e6;
  let s = "";
  if (mm) s = mm === 1 ? "UN MILLÓN" : `${mm < 1000 ? menorMil(mm) : bajoMillon(mm)} MILLONES`;
  if (resto) s += (s ? " " : "") + bajoMillon(resto);
  if (mm && !resto) s += " DE";
  return s;
}

export function valorEnLetras(n: number): string {
  return n ? `${enLetras(n)} PESOS M/CTE` : "";
}

// 50000000 → "50.000.000"; 0 → "" (como money() del POC, sin prefijo).
export function formatoMiles(n: number): string {
  if (!n) return "";
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "10.5000" → "10,50" (dos decimales, coma decimal) para los PDF.
export function tasaTexto(tasa: string): string {
  const [entera = "0", decimal = ""] = tasa.split(".");
  return `${entera},${decimal.slice(0, 2).padEnd(2, "0")}`;
}
