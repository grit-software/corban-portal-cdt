import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormularioCondicion } from "@/components/staff/formulario-condicion";
import { FormularioFestivo } from "@/components/staff/formulario-festivo";
import { type FilaCondicionVista, TablaCondiciones } from "@/components/staff/tabla-condiciones";
import { getActor } from "@/server/auth/actor";
import {
  listarCondiciones,
  listarEntidades,
  listarFestivos,
} from "@/server/condiciones/repositorio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Condiciones de tasa · Corban CDT",
};

const PESTANAS = [
  { clave: "tasas", etiqueta: "Tasas" },
  { clave: "entidades", etiqueta: "Entidades" },
  { clave: "festivos", etiqueta: "Festivos" },
] as const;

export default async function PaginaCondiciones({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const actor = await getActor(await headers());
  // Lo que el actor no puede ver responde como si no existiera (CLAUDE.md, regla 5).
  if (actor?.tipo !== "staff" || actor.rol !== "coordinador") {
    notFound();
  }
  const { pestana } = await searchParams;
  const activa = PESTANAS.some((p) => p.clave === pestana) ? pestana : "tasas";

  const [condiciones, entidades, festivos] = await Promise.all([
    listarCondiciones(actor),
    listarEntidades(actor),
    listarFestivos(actor),
  ]);
  const nombreEntidad = new Map(entidades.map((e) => [e.id, e.nombre]));
  const filas: FilaCondicionVista[] = condiciones.map((c) => ({
    id: c.id,
    entidad: nombreEntidad.get(c.entidadId) ?? c.entidadId,
    plazoDias: c.plazoDias,
    periodicidad: c.periodicidad,
    montoMin: c.montoMin,
    montoMax: c.montoMax,
    tasaEa: c.tasaEa,
    vigenteDesde: c.vigenteDesde,
    vigenteHasta: c.vigenteHasta,
    demo: c.creadoPor === null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Condiciones de tasa</h1>
      <nav aria-label="Secciones" className="flex gap-2 border-b border-border">
        {PESTANAS.map((p) => (
          <Link
            key={p.clave}
            href={`/coordinador/condiciones?pestana=${p.clave}`}
            aria-current={activa === p.clave ? "page" : undefined}
            className={`min-h-10 px-3 py-2 text-sm ${activa === p.clave ? "border-b-2 border-primary font-medium text-primary" : "text-muted-foreground"}`}
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>

      {activa === "tasas" ? (
        <section className="flex flex-col gap-6">
          <TablaCondiciones filas={filas} />
          <h2 className="text-lg font-semibold">Agregar condición</h2>
          <FormularioCondicion entidades={entidades.map((e) => ({ id: e.id, nombre: e.nombre }))} />
        </section>
      ) : null}

      {activa === "entidades" ? (
        <ul className="flex flex-col divide-y divide-border">
          {entidades.map((e) => (
            <li key={e.id} className="flex min-h-10 items-center justify-between py-2">
              <span>{e.nombre}</span>
              <span className="text-sm text-muted-foreground">
                Monto mínimo {e.montoMinimo.toLocaleString("es-CO")} · base {e.baseCalculo}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {activa === "festivos" ? (
        <section className="flex flex-col gap-6">
          {festivos.length === 0 ? (
            <p className="text-muted-foreground">No hay festivos registrados.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {festivos.map((f) => (
                <li key={f.fecha} className="flex min-h-10 items-center justify-between py-2">
                  <span>{f.fecha}</span>
                  <span>{f.nombre}</span>
                </li>
              ))}
            </ul>
          )}
          <FormularioFestivo />
        </section>
      ) : null}
    </div>
  );
}
