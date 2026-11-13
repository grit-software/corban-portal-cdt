import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Asistente } from "@/components/cliente/asistente";
import { ORDEN_ASISTENTE, type PasoAsistente } from "@/lib/datos/pasos";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { listarEntidades } from "@/server/condiciones/repositorio";
import { obtenerSolicitud } from "@/server/solicitudes/servicio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Completa tu CDT · Corban CDT",
};

// Asistente del CDT. Solo en borrador o devuelta; en cualquier otro estado va al detalle.
export default async function PaginaEditarSolicitud({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ paso?: string }>;
}) {
  const { id } = await params;
  const { paso } = await searchParams;
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
  const { solicitud } = detalle;
  if (solicitud.estado !== "borrador" && solicitud.estado !== "devuelta") {
    redirect(`/mi-cuenta/solicitudes/${id}`);
  }

  const entidad = (await listarEntidades(actor)).find((e) => e.id === solicitud.entidadId);
  if (!entidad) {
    notFound();
  }
  const pasoActual: PasoAsistente = ORDEN_ASISTENTE.includes(paso as PasoAsistente)
    ? (paso as PasoAsistente)
    : "cdt";

  return (
    <Asistente
      solicitudId={id}
      paso={pasoActual}
      datos={solicitud.datos}
      entidad={{ id: entidad.id, nombre: entidad.nombre, plazoEnMeses: entidad.plazoEnMeses }}
    />
  );
}
