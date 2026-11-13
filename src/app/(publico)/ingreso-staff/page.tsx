import type { Metadata } from "next";
import { BotonMicrosoft } from "@/components/staff/boton-microsoft";
import { getEnv } from "@/lib/env";

// Lee la configuración de Entra en cada petición: nunca en tiempo de build.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ingreso del equipo · Corban CDT",
};

export default function PaginaIngresoStaff() {
  const env = getEnv();
  const configurado = Boolean(
    env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET && env.ENTRA_TENANT_ID,
  );
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ingreso del equipo Corban</h1>
      {configurado ? (
        <>
          <p className="text-muted-foreground">Ingresa con tu cuenta corporativa de Microsoft.</p>
          <BotonMicrosoft />
        </>
      ) : (
        <p role="alert" className="text-destructive">
          El ingreso con Microsoft no está configurado en este entorno.
        </p>
      )}
    </div>
  );
}
