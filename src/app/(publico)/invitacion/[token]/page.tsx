import { headers } from "next/headers";
import type { Metadata } from "next";
import Link from "next/link";
import { AceptarInvitacion } from "@/components/cliente/aceptar-invitacion";
import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { consultarInvitacion } from "@/server/clientes/acceso/invitacion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitación · Corban CDT",
};

export default async function PaginaInvitacion({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let nombreAsesor: string;
  try {
    ({ nombreAsesor } = await consultarInvitacion(token));
  } catch (error) {
    if (error instanceof ErrorDominio) {
      return (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Esta invitación ya no es válida</h1>
          <p className="text-muted-foreground">Pide a tu asesor una invitación nueva.</p>
        </div>
      );
    }
    throw error;
  }

  const actor = await getActor(await headers());
  const destino = `/invitacion/${token}`;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{nombreAsesor} te invita a abrir tu CDT</h1>
      <p className="text-muted-foreground">
        Acepta la invitación para que tu asesor pueda acompañarte.
      </p>
      {actor ? (
        <AceptarInvitacion token={token} />
      ) : (
        <Link
          href={`/ingreso?siguiente=${encodeURIComponent(destino)}`}
          className="min-h-11 rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground"
        >
          Ingresar para aceptar
        </Link>
      )}
    </div>
  );
}
