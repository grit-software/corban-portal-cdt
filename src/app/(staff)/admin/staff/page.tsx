import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { FormularioDesactivar } from "@/components/staff/formulario-desactivar";
import { getActor } from "@/server/auth/actor";
import { can } from "@/server/authz/can";
import { getDb } from "@/server/db/client";
import { staffMembers } from "@/server/db/schema";
import { asc } from "drizzle-orm";
import { cambiarRolAccion, crearMiembroAccion, desactivarAccion } from "./acciones";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff · Corban CDT",
};

const ROLES = ["asesor", "coordinador", "gerencia", "admin"] as const;

export default async function PaginaStaff() {
  const actor = await getActor(await headers());
  // Lo que el actor no puede ver responde como si no existiera (CLAUDE.md, regla 5).
  if (!actor || !can(actor, "staff.administrar")) {
    notFound();
  }
  const miembros = await getDb()
    .select({
      id: staffMembers.id,
      nombre: staffMembers.nombre,
      email: staffMembers.email,
      rol: staffMembers.rol,
      activo: staffMembers.activo,
    })
    .from(staffMembers)
    .orderBy(asc(staffMembers.nombre));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold">Staff</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Agregar miembro</h2>
        <form action={crearMiembroAccion} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1">
            <span>Correo</span>
            <input
              name="email"
              type="email"
              required
              className="min-h-11 rounded-lg border border-border px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Nombre</span>
            <input
              name="nombre"
              required
              className="min-h-11 rounded-lg border border-border px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Rol</span>
            <select name="rol" required className="min-h-11 rounded-lg border border-border px-3">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="min-h-11 self-end rounded-lg bg-primary px-4 text-primary-foreground"
          >
            Agregar
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Miembros</h2>
        <ul className="flex flex-col divide-y divide-border">
          {miembros.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 py-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{m.nombre}</span>
                <span className="text-sm text-muted-foreground">{m.email}</span>
                {m.activo ? null : <span className="text-sm text-destructive">Inactivo</span>}
              </div>
              {m.activo ? (
                <div className="flex flex-wrap items-center gap-3">
                  <form action={cambiarRolAccion} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <label className="sr-only" htmlFor={`rol-${m.id}`}>
                      Rol de {m.nombre}
                    </label>
                    <select
                      id={`rol-${m.id}`}
                      name="rol"
                      defaultValue={m.rol}
                      className="min-h-11 rounded-lg border border-border px-3"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <label className="sr-only" htmlFor={`motivo-rol-${m.id}`}>
                      Motivo del cambio de rol
                    </label>
                    <input
                      id={`motivo-rol-${m.id}`}
                      name="motivo"
                      required
                      placeholder="Motivo"
                      className="min-h-11 rounded-lg border border-border px-3"
                    />
                    <button type="submit" className="min-h-11 rounded-lg border border-border px-3">
                      Cambiar rol
                    </button>
                  </form>
                  <FormularioDesactivar id={m.id} nombre={m.nombre} accion={desactivarAccion} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
