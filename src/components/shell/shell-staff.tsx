import Link from "next/link";
import type { ReactNode } from "react";
import { MenuMovil, type ElementoMenu } from "@/components/shell/menu-movil";
import type { ActorStaff } from "@/server/authz/actor";
import { can } from "@/server/authz/can";

// Secciones del staff y la acción que las habilita. La página sigue validando cada registro.
const SECCIONES = [
  { href: "/asesor", etiqueta: "Solicitudes", accion: "solicitud.ver" },
  { href: "/asesor/clientes", etiqueta: "Clientes", accion: "cliente.ver" },
  { href: "/coordinador/condiciones", etiqueta: "Condiciones", accion: "condiciones.administrar" },
  { href: "/coordinador/reportes", etiqueta: "Reportes", accion: "reportes.ver" },
  { href: "/admin/staff", etiqueta: "Equipo", accion: "staff.administrar" },
] as const;

// Barra navy ≥ 1024 px; a menos de 1024 px, el Sheet. Solo se muestran las secciones que el
// rol puede abrir (can() sin recurso: las celdas con alcance se evalúan con el propio staffId).
export function ShellStaff({ actor, children }: { actor: ActorStaff; children: ReactNode }) {
  const elementos: ElementoMenu[] = SECCIONES.filter((s) =>
    can(actor, s.accion, { asesorId: actor.staffId }),
  ).map((s) => ({ href: s.href, etiqueta: s.etiqueta }));

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="hidden bg-navy text-white lg:block">
        <div className="sticky top-0 flex flex-col gap-6 p-4">
          <Link href="/" className="font-heading text-lg font-semibold text-white">
            Corban CDT
          </Link>
          <nav aria-label="Secciones" className="flex flex-col gap-1">
            {elementos.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                className="flex min-h-10 items-center rounded-lg px-3 text-sm text-white hover:bg-navy-dark motion-reduce:transition-none"
              >
                {e.etiqueta}
              </Link>
            ))}
          </nav>
        </div>
      </aside>
      <div className="flex flex-col">
        <header className="flex items-center justify-between border-b border-border bg-navy px-4 py-2 lg:hidden">
          <span className="font-heading font-semibold text-white">Corban CDT</span>
          <MenuMovil elementos={elementos} />
        </header>
        <main id="contenido" className="mx-auto w-full max-w-6xl p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
