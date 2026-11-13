"use client";

import { useState } from "react";

// Acepta la autorización Ley 1581. El texto legal llega por props desde la página del servidor.
export function FormularioConsentimiento({ texto }: { texto: string }) {
  const [acepta, setAcepta] = useState(false);
  const [estado, setEstado] = useState<"inicial" | "enviando" | "guardado" | "error">("inicial");

  async function guardar() {
    setEstado("enviando");
    const respuesta = await fetch("/api/v1/consentimiento", { method: "POST" });
    setEstado(respuesta.ok ? "guardado" : "error");
  }

  if (estado === "guardado") {
    return <p className="text-success-strong">Gracias. Tu autorización quedó registrada.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="whitespace-pre-line text-base leading-6">{texto}</p>
      <label className="flex min-h-11 items-start gap-3">
        <input
          type="checkbox"
          checked={acepta}
          onChange={(e) => setAcepta(e.target.checked)}
          className="mt-1 size-5"
        />
        <span>Acepto el tratamiento de mis datos en los términos anteriores.</span>
      </label>
      {estado === "error" ? (
        <p role="alert" className="text-destructive">
          No pudimos guardar tu autorización. Intenta de nuevo.
        </p>
      ) : null}
      <button
        type="button"
        onClick={guardar}
        disabled={!acepta || estado === "enviando"}
        className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
      >
        {estado === "enviando" ? "Guardando…" : "Autorizar"}
      </button>
    </div>
  );
}
