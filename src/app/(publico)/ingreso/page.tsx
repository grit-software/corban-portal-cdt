import type { Metadata } from "next";
import { FormularioIngreso } from "@/components/cliente/formulario-ingreso";

export const metadata: Metadata = {
  title: "Ingresar · Corban CDT",
};

// Solo rutas internas: evita redirecciones a otros sitios.
function destinoSeguro(valor: string | undefined): string {
  return valor?.startsWith("/") && !valor.startsWith("//") ? valor : "/";
}

export default async function PaginaIngreso({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string }>;
}) {
  const { siguiente } = await searchParams;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ingresa a tu cuenta</h1>
      <p className="text-muted-foreground">
        Te enviaremos un código a tu correo. No necesitas contraseña.
      </p>
      <FormularioIngreso siguiente={destinoSeguro(siguiente)} />
    </div>
  );
}
