"use client";

import { authClient } from "@/lib/auth-cliente";

// Inicio de sesión del staff con Microsoft Entra ID.
export function BotonMicrosoft() {
  return (
    <button
      type="button"
      onClick={() => authClient.signIn.social({ provider: "microsoft", callbackURL: "/" })}
      className="min-h-11 rounded-lg bg-navy px-4 font-medium text-white shadow-card transition-colors duration-150 hover:bg-navy-dark motion-reduce:transition-none"
    >
      Ingresar con Microsoft
    </button>
  );
}
