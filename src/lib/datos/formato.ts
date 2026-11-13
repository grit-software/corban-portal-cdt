// Formato de números para mostrar (puro: sin Intl, para que sea igual en servidor y navegador).

// 50000000 → "50.000.000"; 0 → "" (como money() del POC, sin prefijo).
export function formatoMiles(n: number): string {
  if (!n) return "";
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

// "2026-03-02" → "2 de marzo de 2026". La fecha de negocio se lee en UTC: no cambia de día.
export function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T00:00:00Z`).toLocaleDateString("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// "10.5000" → "10,50" (dos decimales, coma decimal) para los PDF y la interfaz.
export function tasaTexto(tasa: string): string {
  const [entera = "0", decimal = ""] = tasa.split(".");
  return `${entera},${decimal.slice(0, 2).padEnd(2, "0")}`;
}
