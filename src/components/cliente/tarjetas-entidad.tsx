"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { llamarApi } from "./api.ts";

// Tarjetas de entidad: al elegir una se crea el borrador y se abre el paso del CDT.
export function TarjetasEntidad({ entidades }: { entidades: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(entidadId: string) {
    setCreando(entidadId);
    setError(null);
    const resultado = await llamarApi<{ id: string }>("POST", "/api/v1/solicitudes", { entidadId });
    if (!resultado.ok) {
      setCreando(null);
      setError(resultado.error.message);
      return;
    }
    router.push(`/mi-cuenta/solicitudes/${resultado.data.id}/editar?paso=cdt`);
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <ul className="grid gap-3 sm:grid-cols-2">
        {entidades.map((entidad) => (
          <li key={entidad.id}>
            <button
              type="button"
              disabled={creando !== null}
              onClick={() => elegir(entidad.id)}
              className="flex min-h-11 w-full flex-col items-start gap-1 rounded-lg bg-card p-4 text-left shadow-card transition-colors duration-150 hover:border-primary motion-reduce:transition-none disabled:opacity-60"
            >
              <span className="font-heading text-lg font-semibold">{entidad.nombre}</span>
              <span className="text-sm text-muted-foreground">
                {creando === entidad.id ? "Abriendo…" : "Abrir un CDT con esta entidad"}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
