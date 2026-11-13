import Link from "next/link";
import { fechaLarga, formatoMiles } from "@/lib/datos/formato";
import type { Portafolio } from "@/lib/portafolio/tipos";

// Resumen del portafolio: total invertido, cantidad vigente y el próximo vencimiento. Sin CDT
// constituidos muestra el estado vacío; en la página del portafolio con «Abrir un CDT».
// En el inicio (`enInicio`) enlaza a la página completa y no repite el botón del encabezado.
export function ResumenPortafolio({
  portafolio,
  enInicio = false,
}: {
  portafolio: Portafolio;
  enInicio?: boolean;
}) {
  const { vigentes, totalInvertido, proximosVencimientos } = portafolio;

  if (vigentes.length === 0) {
    return (
      <section
        aria-labelledby="titulo-resumen"
        className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-card"
      >
        <h2 id="titulo-resumen" className="text-lg font-semibold">
          Mi portafolio
        </h2>
        <p className="text-muted-foreground">Aún no tienes CDT constituidos.</p>
        {enInicio ? null : (
          <Link
            href="/mi-cuenta/solicitudes/nueva"
            className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card motion-reduce:transition-none"
          >
            Abrir un CDT
          </Link>
        )}
      </section>
    );
  }

  const proximo = proximosVencimientos[0];
  return (
    <section
      aria-labelledby="titulo-resumen"
      className="flex flex-col gap-3 rounded-lg bg-card p-4 shadow-card"
    >
      <h2 id="titulo-resumen" className="text-lg font-semibold">
        Mi portafolio
      </h2>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">Total invertido</dt>
          <dd className="text-xl font-semibold">$ {formatoMiles(totalInvertido)}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-sm text-muted-foreground">CDT vigentes</dt>
          <dd className="text-xl font-semibold">{vigentes.length}</dd>
        </div>
        {proximo ? (
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-muted-foreground">Próximo vencimiento</dt>
            <dd className="text-base font-medium">{fechaLarga(proximo.fechaVenc)}</dd>
          </div>
        ) : null}
      </dl>
      {enInicio ? (
        <Link
          href="/mi-cuenta/portafolio"
          className="flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline motion-reduce:transition-none"
        >
          Ver mi portafolio
        </Link>
      ) : null}
    </section>
  );
}
