import { fechaLarga, formatoMiles, tasaTexto } from "@/lib/datos/formato";
import type { CdtPortafolio } from "@/lib/portafolio/tipos";

const PERIODICIDAD: Record<string, string> = {
  vencimiento: "Al vencimiento",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

// Un CDT vigente: entidad, número, valor, tasa, vencimiento y periodicidad.
export function TarjetaCdt({ cdt }: { cdt: CdtPortafolio }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold">{cdt.entidad}</h3>
        <span className="text-sm text-muted-foreground">CDT {cdt.numeroCdt}</span>
      </div>
      <p className="text-lg font-semibold">$ {formatoMiles(cdt.valor)}</p>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Tasa efectiva anual</dt>
        <dd>{tasaTexto(cdt.tasaEa)} %</dd>
        <dt className="text-muted-foreground">Vence</dt>
        <dd>{fechaLarga(cdt.fechaVenc)}</dd>
        <dt className="text-muted-foreground">Pago de intereses</dt>
        <dd>{PERIODICIDAD[cdt.periodicidad] ?? cdt.periodicidad}</dd>
      </dl>
    </article>
  );
}
