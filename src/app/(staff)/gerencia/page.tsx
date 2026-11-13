import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BarrasEstados } from "@/components/staff/graficos/barras-estados";
import { BarrasInversion } from "@/components/staff/graficos/barras-inversion";
import { getActor } from "@/server/auth/actor";
import { can } from "@/server/authz/can";
import {
  type Dias,
  type FiltrosReporte,
  inversion,
  opcionesFiltro,
  resumenSolicitudes,
  vencimientos,
} from "@/server/reportes/consultas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reportes de gerencia · Corban CDT",
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

function filtrosDe(params: Record<string, string | undefined>): {
  filtros: FiltrosReporte;
  dias: Dias;
} {
  const dias = Number(params.dias);
  return {
    filtros: {
      desde: params.desde && FECHA.test(params.desde) ? params.desde : undefined,
      hasta: params.hasta && FECHA.test(params.hasta) ? params.hasta : undefined,
      entidadId: params.entidadId || undefined,
      asesorId: params.asesorId || undefined,
    },
    dias: dias === 60 || dias === 90 ? dias : 30,
  };
}

export default async function PaginaGerencia({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const actor = await getActor(await headers());
  // Lo que el actor no puede ver responde como si no existiera (CLAUDE.md, regla 5).
  if (!actor || !can(actor, "reportes.ver")) {
    notFound();
  }
  const { filtros, dias } = filtrosDe(await searchParams);

  const [inv, venc, resumen, opciones] = await Promise.all([
    inversion(actor, filtros),
    vencimientos(actor, dias, filtros),
    resumenSolicitudes(actor, filtros),
    opcionesFiltro(actor),
  ]);

  const consulta = new URLSearchParams();
  for (const [clave, valor] of Object.entries({ ...filtros, dias: String(dias) })) {
    if (valor) consulta.set(clave, valor);
  }
  const sufijo = consulta.toString() ? `?${consulta.toString()}` : "";

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Reportes de gerencia</h1>

      <form method="get" className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Filtros">
        <label className="flex flex-col gap-1">
          <span>Desde</span>
          <input
            type="date"
            name="desde"
            defaultValue={filtros.desde}
            className="min-h-11 rounded-lg border border-border px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Hasta</span>
          <input
            type="date"
            name="hasta"
            defaultValue={filtros.hasta}
            className="min-h-11 rounded-lg border border-border px-3"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span>Entidad</span>
          <select
            name="entidadId"
            defaultValue={filtros.entidadId ?? ""}
            className="min-h-11 rounded-lg border border-border px-3"
          >
            <option value="">Todas</option>
            {opciones.entidades.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Asesor</span>
          <select
            name="asesorId"
            defaultValue={filtros.asesorId ?? ""}
            className="min-h-11 rounded-lg border border-border px-3"
          >
            <option value="">Todos</option>
            {opciones.asesores.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span>Próximos vencimientos</span>
          <select
            name="dias"
            defaultValue={String(dias)}
            className="min-h-11 rounded-lg border border-border px-3"
          >
            <option value="30">30 días</option>
            <option value="60">60 días</option>
            <option value="90">90 días</option>
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 self-end rounded-lg bg-primary px-4 text-primary-foreground"
        >
          Aplicar
        </button>
      </form>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Inversión vigente</h2>
        <BarrasInversion
          datos={inv.porEntidad.map((e) => ({ nombre: e.nombre, total: e.total }))}
        />
        <table className="w-full text-sm">
          <caption className="sr-only">Inversión vigente por entidad y asesor</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2">
                Entidad
              </th>
              <th scope="col" className="py-2">
                Asesor
              </th>
              <th scope="col" className="py-2 text-right">
                Total invertido
              </th>
            </tr>
          </thead>
          <tbody>
            {inv.detalle.map((f) => (
              <tr key={`${f.entidadId}-${f.asesorId ?? "none"}`} className="border-b border-border">
                <td className="py-2">{f.entidadNombre}</td>
                <td className="py-2">{f.asesorNombre ?? "Sin asesor"}</td>
                <td className="py-2 text-right">{COP.format(f.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <a
          href={`/api/staff/reportes/inversion/xlsx${sufijo}`}
          className="min-h-11 text-primary underline"
        >
          Descargar inversión (.xlsx)
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Vencimientos en {dias} días</h2>
        {venc.length === 0 ? (
          <p className="text-muted-foreground">No hay CDT que venzan en este rango.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">CDT que vencen en {dias} días</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2">
                  Cliente
                </th>
                <th scope="col" className="py-2">
                  Entidad
                </th>
                <th scope="col" className="py-2">
                  Número CDT
                </th>
                <th scope="col" className="py-2 text-right">
                  Valor
                </th>
                <th scope="col" className="py-2">
                  Vencimiento
                </th>
              </tr>
            </thead>
            <tbody>
              {venc.map((f) => (
                <tr key={f.cdtId} className="border-b border-border">
                  <td className="py-2">{f.cliente}</td>
                  <td className="py-2">{f.entidad}</td>
                  <td className="py-2">{f.numeroCdt}</td>
                  <td className="py-2 text-right">{COP.format(f.valor)}</td>
                  <td className="py-2">{f.vencimiento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <a
          href={`/api/staff/reportes/vencimientos/xlsx${sufijo}`}
          className="min-h-11 text-primary underline"
        >
          Descargar vencimientos (.xlsx)
        </a>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Solicitudes</h2>
        <p>
          Constituidas: {resumen.constituidas}
          {resumen.promedioDias === null
            ? ""
            : ` · promedio de ${resumen.promedioDias.toFixed(1)} días desde la solicitud`}
        </p>
        <BarrasEstados datos={resumen.porEstado} />
        <table className="w-full text-sm">
          <caption className="sr-only">Solicitudes por estado</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-2">
                Estado
              </th>
              <th scope="col" className="py-2 text-right">
                Cantidad
              </th>
            </tr>
          </thead>
          <tbody>
            {resumen.porEstado.map((f) => (
              <tr key={f.estado} className="border-b border-border">
                <td className="py-2">{f.estado}</td>
                <td className="py-2 text-right">{f.cantidad}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <a
          href={`/api/staff/reportes/solicitudes/xlsx${sufijo}`}
          className="min-h-11 text-primary underline"
        >
          Descargar solicitudes (.xlsx)
        </a>
      </section>
    </div>
  );
}
