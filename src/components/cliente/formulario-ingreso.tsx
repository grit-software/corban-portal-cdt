"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-cliente";

// Ingreso de cliente por código de correo. El staff no pasa por aquí (usa Microsoft).
export function FormularioIngreso({ siguiente }: { siguiente: string }) {
  const router = useRouter();
  const [paso, setPaso] = useState<"correo" | "codigo">("correo");
  const [correo, setCorreo] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function pedirCodigo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const { error: fallo } = await authClient.emailOtp.sendVerificationOtp({
      email: correo.trim(),
      type: "sign-in",
    });
    setEnviando(false);
    if (fallo) {
      setError(mensajeDeError(fallo.status));
      return;
    }
    setPaso("codigo");
  }

  async function ingresar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    const { error: fallo } = await authClient.signIn.emailOtp({
      email: correo.trim(),
      otp: codigo.trim(),
    });
    setEnviando(false);
    if (fallo) {
      setError(mensajeDeError(fallo.status));
      return;
    }
    // Sin router.refresh(): cancelaría la navegación al destino.
    router.push(siguiente);
  }

  if (paso === "correo") {
    return (
      <form onSubmit={pedirCodigo} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor="correo" className="font-medium">
            Correo electrónico
          </label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="email"
            required
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            aria-describedby={error ? "error-ingreso" : undefined}
            className="min-h-11 rounded-lg border border-input bg-card px-3 text-base"
          />
        </div>
        {error ? (
          <p id="error-ingreso" role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
        >
          {enviando ? "Enviando código…" : "Enviarme un código"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={ingresar} className="flex flex-col gap-4" noValidate>
      <p className="text-muted-foreground">
        Te enviamos un código de 6 dígitos a <strong className="text-foreground">{correo}</strong>.
      </p>
      <div className="flex flex-col gap-2">
        <label htmlFor="codigo" className="font-medium">
          Código de acceso
        </label>
        <input
          id="codigo"
          name="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          aria-describedby={error ? "error-codigo" : undefined}
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-base tracking-widest"
        />
      </div>
      {error ? (
        <p id="error-codigo" role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
      >
        {enviando ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}

function mensajeDeError(estado: number): string {
  if (estado === 429) {
    return "Hiciste demasiados intentos. Espera unos minutos e intenta de nuevo.";
  }
  if (estado === 403) {
    return "Si eres parte del equipo, ingresa con tu cuenta de Microsoft.";
  }
  return "No pudimos validar el código. Revísalo e intenta de nuevo.";
}
