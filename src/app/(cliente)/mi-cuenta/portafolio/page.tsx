import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ResumenPortafolio } from "@/components/cliente/resumen-portafolio";
import { TarjetaCdt } from "@/components/cliente/tarjeta-cdt";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { portafolioDe } from "@/server/portafolio/consultas";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mi portafolio · Corban CDT",
};

// Portafolio del cliente: resumen y tarjetas de los CDT vigentes.
export default async function PaginaPortafolio() {
  const actor = await getActor(await headers());
  if (actor?.tipo !== "cliente") {
    notFound();
  }
  let portafolio: Awaited<ReturnType<typeof portafolioDe>>;
  try {
    portafolio = await portafolioDe(actor);
  } catch (error) {
    if (error instanceof ErrorDominio) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Mi portafolio</h1>
      <ResumenPortafolio portafolio={portafolio} />

      {portafolio.vigentes.length > 0 ? (
        <section aria-labelledby="titulo-vigentes" className="flex flex-col gap-3">
          <h2 id="titulo-vigentes" className="text-lg font-semibold">
            Mis CDT vigentes
          </h2>
          <ul className="flex flex-col gap-3">
            {portafolio.vigentes.map((cdt) => (
              <li key={cdt.id}>
                <TarjetaCdt cdt={cdt} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
