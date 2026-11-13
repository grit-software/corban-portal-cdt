"use client";

import { type FormEvent, useState } from "react";
import { guardarFestivo } from "@/app/(staff)/coordinador/condiciones/acciones";

// Alta de un festivo. Afecta solo los vencimientos calculados después.
export function FormularioFestivo() {
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const resultado = await guardarFestivo(
      { fecha: String(datos.get("fecha") ?? ""), nombre: String(datos.get("nombre") ?? "") },
      false,
    );
    setGuardado(resultado.ok);
    setError(resultado.ok ? null : resultado.error.message);
  }

  if (guardado) {
    return <p className="text-success-strong">Festivo guardado.</p>;
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-4 sm:flex-row sm:items-end" noValidate>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="fecha" className="text-sm font-medium">
          Fecha (aaaa-mm-dd)
        </label>
        <input
          id="fecha"
          name="fecha"
          required
          className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="nombre" className="text-sm font-medium">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm"
        />
      </div>
      <button
        type="submit"
        className="min-h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground"
      >
        Agregar festivo
      </button>
    </form>
  );
}
