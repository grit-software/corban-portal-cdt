import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Abre tu CDT en línea · Corban CDT",
};

// Portada pública: diligencia una sola vez tus datos y sigue tu CDT.
export default function Portada() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold">Abre tu CDT en línea, sin filas</h1>
      <p className="text-base leading-6 text-muted-foreground">
        Diligencia tus datos una sola vez, descarga los formatos ya llenos, firma y sigue tu
        portafolio desde un solo lugar.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/registro"
          className="min-h-11 rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground shadow-card"
        >
          Crear mi registro
        </Link>
        <Link
          href="/ingreso"
          className="min-h-11 rounded-lg border border-border bg-card px-4 py-3 text-center font-medium text-foreground"
        >
          Ya tengo cuenta
        </Link>
      </div>
    </div>
  );
}
