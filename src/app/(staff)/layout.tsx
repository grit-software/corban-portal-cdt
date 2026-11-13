import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ShellStaff } from "@/components/shell/shell-staff";
import { getActor } from "@/server/auth/actor";

export const dynamic = "force-dynamic";

// Área de staff: solo staff activo. Sin sesión, a /ingreso-staff; un cliente recibe 404.
export default async function LayoutStaff({ children }: { children: ReactNode }) {
  const actor = await getActor(await headers());
  if (!actor) {
    redirect("/ingreso-staff");
  }
  if (actor.tipo !== "staff") {
    notFound();
  }
  return <ShellStaff actor={actor}>{children}</ShellStaff>;
}
