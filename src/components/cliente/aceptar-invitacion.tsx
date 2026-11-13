"use client";

import Link from "next/link";
import { useState } from "react";

// Acepta la invitación del token de la URL. Requiere sesión (el servidor responde 401 sin ella).
export function AceptarInvitacion({ token }: { token: string }) {
  const [estado, setEstado] = useState<"inicial" | "enviando" | "aceptada" | "error">("inicial");
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function aceptar() {
    setEstado("enviando");
    setMensaje(null);
    const respuesta = await fetch(`/api/v1/auth/invitaciones/${token}/aceptar`, { method: "POST" });
    if (respuesta.ok) {
      setEstado("aceptada");
      return;
    }
    setEstado("error");
    setMensaje(
      respuesta.status === 401
        ? "Ingresa con tu correo para aceptar la invitación."
        : "Esta invitación ya no es válida. Pide a tu asesor una nueva.",
    );
  }

  if (estado === "aceptada") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-success-strong">
          Invitación aceptada. Ahora autoriza el tratamiento de tus datos.
        </p>
        <Link
          href="/consentimiento"
          className="min-h-11 rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground"
        >
          Continuar
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {mensaje ? (
        <p role="alert" className="text-destructive">
          {mensaje}
        </p>
      ) : null}
      <button
        type="button"
        onClick={aceptar}
        disabled={estado === "enviando"}
        className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
      >
        {estado === "enviando" ? "Aceptando…" : "Aceptar invitación"}
      </button>
    </div>
  );
}
