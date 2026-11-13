import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FormularioConsentimiento } from "@/components/cliente/formulario-consentimiento";
import { getActor } from "@/server/auth/actor";
import { TEXTO_CONSENTIMIENTO } from "@/lib/textos/consentimiento";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Autorización de datos · Corban CDT",
};

export default async function PaginaConsentimiento() {
  const actor = await getActor(await headers());
  if (actor?.tipo !== "cliente") {
    redirect("/ingreso?siguiente=%2Fconsentimiento");
  }
  if (actor.consentimiento) {
    return <p className="text-success-strong">Tu autorización ya está registrada.</p>;
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Autoriza el tratamiento de tus datos</h1>
      <FormularioConsentimiento texto={TEXTO_CONSENTIMIENTO} />
    </div>
  );
}
