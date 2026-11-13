import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { ShellCliente } from "@/components/shell/shell-cliente";
import { getActor } from "@/server/auth/actor";

export const dynamic = "force-dynamic";

// Acceso al área de cliente: sesión, luego registro completo, luego consentimiento.
export default async function LayoutMiCuenta({ children }: { children: ReactNode }) {
  const actor = await getActor(await headers());
  if (!actor) {
    redirect("/ingreso?siguiente=%2Fmi-cuenta");
  }
  if (actor.tipo === "staff") {
    redirect("/asesor");
  }
  if (!actor.clienteId) {
    return (
      <ShellCliente>
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Completa tu registro</h1>
          <p className="text-muted-foreground">Necesitamos tus datos antes de abrir un CDT.</p>
          <Link
            href="/registro"
            className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
          >
            Completar registro
          </Link>
        </div>
      </ShellCliente>
    );
  }
  if (!actor.consentimiento) {
    redirect("/consentimiento");
  }
  return <ShellCliente>{children}</ShellCliente>;
}
