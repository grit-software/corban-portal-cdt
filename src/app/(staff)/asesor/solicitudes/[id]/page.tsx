import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AccionesSolicitud } from "@/components/staff/acciones-solicitud";
import { ETIQUETA_ESTADO } from "@/lib/datos/pasos";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { FormularioConstitucion } from "@/components/staff/formulario-constitucion";
import { detalleStaff } from "@/server/solicitudes/consultas";
import { registrarConstitucion } from "./acciones.ts";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solicitud · Corban CDT",
};

// Detalle del asesor: estado, alerta de vigencia, versiones, documentos y las acciones que
// la máquina de estados permite en ese estado.
export default async function PaginaDetalleAsesor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getActor(await headers());
  if (actor?.tipo !== "staff") {
    notFound();
  }
  let detalle: Awaited<ReturnType<typeof detalleStaff>>;
  try {
    detalle = await detalleStaff(actor, id);
  } catch (error) {
    if (error instanceof ErrorDominio) notFound();
    throw error;
  }
  const { solicitud, eventos, versiones, documentos, alertaVigencia } = detalle;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{solicitud.codigo}</p>
        <h1 className="text-2xl font-semibold">
          {ETIQUETA_ESTADO[solicitud.estado] ?? solicitud.estado}
        </h1>
      </div>

      {alertaVigencia ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-destructive">
          La tasa aprobada perdió vigencia: edita la solicitud para tomar la tasa actual como nueva
          versión.
        </p>
      ) : null}

      <AccionesSolicitud solicitudId={id} estado={solicitud.estado} />

      {solicitud.estado === "enviada_entidad" ? (
        <section aria-labelledby="titulo-constitucion" className="flex flex-col gap-4">
          <h2 id="titulo-constitucion" className="text-lg font-semibold">
            Registrar constitución
          </h2>
          <p className="text-sm text-muted-foreground">
            Confirma los datos finales que aparecen en el CDT constituido. Vienen prellenados con
            los valores aprobados; si cambiaron, corrígelos aquí.
          </p>
          <FormularioConstitucion
            valores={{
              valor: solicitud.valor,
              tasaEa: solicitud.tasaEa,
              fechaApertura: solicitud.fechaApertura,
              fechaVenc: solicitud.fechaVenc,
            }}
            registrar={registrarConstitucion.bind(null, id)}
          />
        </section>
      ) : null}

      <section aria-labelledby="titulo-versiones" className="flex flex-col gap-2">
        <h2 id="titulo-versiones" className="text-lg font-semibold">
          Versiones y documentos
        </h2>
        {versiones.length === 0 ? (
          <p className="text-muted-foreground">Aún no hay versiones aprobadas.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {versiones.map((v) => (
              <li key={v.numero}>
                Versión {v.numero}: {documentos.filter((d) => d.version === v.numero).length}{" "}
                documentos
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="titulo-linea" className="flex flex-col gap-2">
        <h2 id="titulo-linea" className="text-lg font-semibold">
          Línea de tiempo
        </h2>
        <ol className="flex flex-col gap-2">
          {eventos.map((e) => (
            <li
              key={`${e.creadoEn}-${e.hacia ?? e.nota}`}
              className="border-l-2 border-border pl-3"
            >
              <span className="font-medium">
                {ETIQUETA_ESTADO[e.hacia ?? ""] ?? e.nota ?? e.tipo}
              </span>
              {e.nota ? (
                <span className="block text-sm text-muted-foreground">{e.nota}</span>
              ) : null}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
