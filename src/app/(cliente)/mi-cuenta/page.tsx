import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mi cuenta · Corban CDT",
};

// Marcador de E2-T3: el inicio real (solicitudes y «Abrir un CDT») llega en el asistente.
export default function PaginaMiCuenta() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>
      <p className="text-muted-foreground">Pronto verás tus solicitudes aquí.</p>
    </div>
  );
}
