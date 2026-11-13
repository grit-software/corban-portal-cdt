import type { Metadata } from "next";
import { FormularioRegistro } from "@/components/cliente/formulario-registro";

export const metadata: Metadata = {
  title: "Crear mi registro · Corban CDT",
};

export default function PaginaRegistro() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Crea tu registro</h1>
      <p className="text-muted-foreground">
        Estos datos se usan una sola vez para todas tus solicitudes.
      </p>
      <FormularioRegistro />
    </div>
  );
}
