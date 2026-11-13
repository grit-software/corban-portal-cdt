import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ImportadorExcel } from "@/components/staff/importador-excel";
import { getActor } from "@/server/auth/actor";
import { can } from "@/server/authz/can";
import { listarPerfiles } from "@/server/importacion/perfiles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Importar clientes y CDT · Corban CDT",
};

export default async function PaginaImportar() {
  const actor = await getActor(await headers());
  // Lo que el actor no puede ver responde como si no existiera (CLAUDE.md, regla 5).
  if (!actor || !can(actor, "importacion.ejecutar")) {
    notFound();
  }
  const perfiles = await listarPerfiles(actor);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Importar clientes y CDT</h1>
      <p className="text-muted-foreground">
        Sube un Excel, asigna cada columna y revisa la vista previa antes de confirmar.
      </p>
      <ImportadorExcel
        perfiles={perfiles.map((p) => ({ id: p.id, nombre: p.nombre, mapeo: p.mapeo }))}
      />
    </div>
  );
}
