// Formato de números para mostrar (puro: sin Intl, para que sea igual en servidor y navegador).

// 50000000 → "50.000.000"; 0 → "" (como money() del POC, sin prefijo).
export function formatoMiles(n: number): string {
  if (!n) return "";
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "10.5000" → "10,50" (dos decimales, coma decimal) para los PDF y la interfaz.
export function tasaTexto(tasa: string): string {
  const [entera = "0", decimal = ""] = tasa.split(".");
  return `${entera},${decimal.slice(0, 2).padEnd(2, "0")}`;
}
