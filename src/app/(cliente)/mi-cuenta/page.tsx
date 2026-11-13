import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ETIQUETA_ESTADO, SIGUIENTE_PASO_CLIENTE } from "@/lib/datos/pasos";
import { ResumenPortafolio } from "@/components/cliente/resumen-portafolio";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { portafolioDe } from "@/server/portafolio/consultas";
import { listarMias } from "@/server/solicitudes/servicio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi cuenta · Corban CDT",
};

// Inicio del cliente: resumen del portafolio, sus solicitudes con estado y el siguiente paso,
// y «Abrir un CDT».
export default async function PaginaMiCuenta() {
  const actor = await getActor(await headers());
  if (actor?.tipo !== "cliente") {
    notFound();
  }
  let solicitudes: Awaited<ReturnType<typeof listarMias>>;
  let portafolio: Awaited<ReturnType<typeof portafolioDe>>;
  try {
    [solicitudes, portafolio] = await Promise.all([listarMias(actor), portafolioDe(actor)]);
  } catch (error) {
    if (error instanceof ErrorDominio) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <ResumenPortafolio portafolio={portafolio} enInicio />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Mis solicitudes</h1>
        <Link
          href="/mi-cuenta/solicitudes/nueva"
          className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card"
        >
          Abrir un CDT
        </Link>
      </div>

      {solicitudes.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no tienes solicitudes. Abre tu primer CDT cuando quieras.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <Link
                href={`/mi-cuenta/solicitudes/${s.id}`}
                className="flex min-h-11 flex-col gap-1 rounded-lg bg-card p-4 shadow-card"
              >
                <span className="font-medium">{s.codigo}</span>
                <span className="text-sm text-muted-foreground">
                  {ETIQUETA_ESTADO[s.estado] ?? s.estado}
                </span>
                <span className="text-sm">{SIGUIENTE_PASO_CLIENTE[s.estado] ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
