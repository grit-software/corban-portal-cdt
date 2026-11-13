"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

type Errores = Record<string, string>;

const TIPOS = [
  { valor: "CC", etiqueta: "Cédula de ciudadanía" },
  { valor: "CE", etiqueta: "Cédula de extranjería" },
  { valor: "TI", etiqueta: "Tarjeta de identidad" },
  { valor: "PAS", etiqueta: "Pasaporte" },
  { valor: "NUIP", etiqueta: "NUIP" },
];

// Registro público. Envía a /api/v1/auth/registro y muestra errores junto a cada campo.
export function FormularioRegistro() {
  const [errores, setErrores] = useState<Errores>({});
  const [resumen, setResumen] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    setEnviando(true);
    setErrores({});
    setResumen(null);
    const respuesta = await fetch("/api/v1/auth/registro", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(datos),
    });
    setEnviando(false);
    if (respuesta.ok) {
      setListo(true);
      return;
    }
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { message?: string; fields?: Errores };
    } | null;
    setErrores(cuerpo?.error?.fields ?? {});
    setResumen(cuerpo?.error?.message ?? "No pudimos completar el registro. Intenta de nuevo.");
  }

  if (listo) {
    return (
      <div className="flex flex-col gap-4 rounded-lg bg-card p-6 shadow-card">
        <h2 className="text-xl font-semibold">Tu registro quedó guardado</h2>
        <p className="text-muted-foreground">
          Ahora ingresa con tu correo para continuar con tu solicitud de CDT.
        </p>
        <Link
          href="/ingreso"
          className="min-h-11 rounded-lg bg-primary px-4 py-3 text-center font-medium text-primary-foreground"
        >
          Ir a ingresar
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
      {resumen ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-destructive">
          {resumen}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <label htmlFor="tipoDoc" className="font-medium">
          Tipo de documento
        </label>
        <select
          id="tipoDoc"
          name="tipoDoc"
          required
          className="min-h-11 rounded-lg border border-input bg-card px-3 text-base"
        >
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <Campo id="numDoc" etiqueta="Número de documento" error={errores.numDoc} />
      <Campo id="nombre" etiqueta="Nombre completo" error={errores.nombre} autoComplete="name" />
      <Campo
        id="email"
        etiqueta="Correo electrónico"
        tipo="email"
        error={errores.email}
        autoComplete="email"
      />
      <Campo
        id="celular"
        etiqueta="Celular (opcional)"
        tipo="tel"
        error={errores.celular}
        autoComplete="tel"
        requerido={false}
      />
      <button
        type="submit"
        disabled={enviando}
        className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
      >
        {enviando ? "Guardando…" : "Crear mi registro"}
      </button>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  tipo = "text",
  autoComplete,
  requerido = true,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  tipo?: string;
  autoComplete?: string;
  requerido?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        required={requerido}
        autoComplete={autoComplete}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className="min-h-11 rounded-lg border border-input bg-card px-3 text-base"
      />
      {error ? (
        <p id={`${id}-error`} className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
