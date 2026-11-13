import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentosSolicitud } from "@/components/cliente/documentos-solicitud";
import { ETIQUETA_ESTADO, SIGUIENTE_PASO_CLIENTE } from "@/lib/datos/pasos";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { obtenerSolicitud } from "@/server/solicitudes/servicio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi solicitud · Corban CDT",
};

// Detalle de una solicitud propia: estado, siguiente paso, línea de tiempo y formatos.
export default async function PaginaSolicitud({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(await headers());
  if (!actor) {
    notFound();
  }
  let detalle: Awaited<ReturnType<typeof obtenerSolicitud>>;
  try {
    detalle = await obtenerSolicitud(actor, id);
  } catch (error) {
    if (error instanceof ErrorDominio) notFound();
    throw error;
  }
  const { solicitud, eventos } = detalle;
  const editable = solicitud.estado === "borrador" || solicitud.estado === "devuelta";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{solicitud.codigo}</p>
        <h1 className="text-2xl font-semibold">
          {ETIQUETA_ESTADO[solicitud.estado] ?? solicitud.estado}
        </h1>
        <p>{SIGUIENTE_PASO_CLIENTE[solicitud.estado] ?? ""}</p>
      </div>

      {editable ? (
        <Link
          href={`/mi-cuenta/solicitudes/${id}/editar?paso=cdt`}
          className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card"
        >
          Continuar mi solicitud
        </Link>
      ) : null}

      <DocumentosSolicitud estado={solicitud.estado} />

      <section aria-labelledby="titulo-linea" className="flex flex-col gap-3">
        <h2 id="titulo-linea" className="text-lg font-semibold">
          Línea de tiempo
        </h2>
        {eventos.length === 0 ? (
          <p className="text-muted-foreground">Aún no hay movimientos.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {eventos.map((e) => (
              <li key={`${e.creadoEn}-${e.hacia}`} className="border-l-2 border-border pl-3">
                <span className="font-medium">{ETIQUETA_ESTADO[e.hacia ?? ""] ?? e.hacia}</span>
                <span className="block text-sm text-muted-foreground">
                  {new Date(e.creadoEn).toLocaleString("es-CO", { timeZone: "America/Bogota" })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
