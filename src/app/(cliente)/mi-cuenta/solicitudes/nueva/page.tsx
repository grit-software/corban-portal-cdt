import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { TarjetasEntidad } from "@/components/cliente/tarjetas-entidad";
import { getActor } from "@/server/auth/actor";
import { listarEntidades } from "@/server/condiciones/repositorio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Abrir un CDT · Corban CDT",
};

// Elegir la entidad con la que se abre el CDT.
export default async function PaginaNuevaSolicitud() {
  const actor = await getActor(await headers());
  if (actor?.tipo !== "cliente") {
    notFound();
  }
  const entidades = (await listarEntidades(actor))
    .filter((e) => e.activa)
    .map((e) => ({ id: e.id, nombre: e.nombre }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">¿Con qué entidad abres tu CDT?</h1>
      <p className="text-muted-foreground">
        Elige una entidad. Luego te pediremos los datos de tu inversión.
      </p>
      <TarjetasEntidad entidades={entidades} />
    </div>
  );
}
