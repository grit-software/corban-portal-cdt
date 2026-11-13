import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ETIQUETA_ESTADO } from "@/lib/datos/pasos";
import { getActor } from "@/server/auth/actor";
import { bandeja, listado, POR_PAGINA } from "@/server/solicitudes/consultas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Solicitudes · Corban CDT",
};

// Bandeja del asesor. Con q, búsqueda por código, nombre o documento. Paginada de a 25.
export default async function PaginaBandeja({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const actor = await getActor(await headers());
  if (actor?.tipo !== "staff") {
    notFound();
  }
  const { q, pagina: paginaTexto } = await searchParams;
  const pagina = Math.max(1, Number.parseInt(paginaTexto ?? "1", 10) || 1);

  const busqueda = q?.trim();
  const resultado = busqueda
    ? await listado(actor, { q: busqueda, pagina })
    : { ...(await bandeja(actor, pagina)), total: undefined as number | undefined };
  const total = resultado.total;
  const hayMas =
    total !== undefined ? pagina * POR_PAGINA < total : resultado.filas.length === POR_PAGINA;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Solicitudes</h1>
      <form className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="busqueda" className="sr-only">
          Buscar por código, nombre o documento
        </label>
        <input
          id="busqueda"
          name="q"
          defaultValue={busqueda ?? ""}
          placeholder="Código, nombre o documento"
          className="min-h-11 flex-1 rounded-lg border border-input bg-card px-3"
        />
        <button
          type="submit"
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
        >
          Buscar
        </button>
      </form>

      {resultado.filas.length === 0 ? (
        <p className="text-muted-foreground">No hay solicitudes para mostrar.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {resultado.filas.map((f) => (
            <li key={f.id}>
              <Link
                href={`/asesor/solicitudes/${f.id}`}
                className="flex min-h-11 flex-col gap-1 rounded-lg bg-card p-4 shadow-card"
              >
                <span className="font-medium">{f.codigo}</span>
                <span>{f.clienteNombre}</span>
                <span className="text-sm text-muted-foreground">
                  {ETIQUETA_ESTADO[f.estado] ?? f.estado}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Paginación" className="flex items-center justify-between">
        {pagina > 1 ? (
          <Link
            href={`/asesor?${new URLSearchParams({ ...(busqueda ? { q: busqueda } : {}), pagina: String(pagina - 1) })}`}
            className="min-h-11 py-3 underline"
          >
            Anterior
          </Link>
        ) : (
          <span />
        )}
        <span className="text-sm text-muted-foreground">Página {pagina}</span>
        {hayMas ? (
          <Link
            href={`/asesor?${new URLSearchParams({ ...(busqueda ? { q: busqueda } : {}), pagina: String(pagina + 1) })}`}
            className="min-h-11 py-3 underline"
          >
            Siguiente
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
