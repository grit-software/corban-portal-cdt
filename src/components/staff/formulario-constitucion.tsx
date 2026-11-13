"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import type { ResultadoConstitucion } from "@/lib/portafolio/constitucion";

export type ValoresCongelados = {
  valor: number | null;
  tasaEa: string | null;
  fechaApertura: string | null;
  fechaVenc: string | null;
};

const CAMPOS = ["numeroCdt", "valor", "tasaEa", "fechaApertura", "fechaVenc"] as const;

// Registro de la constitución: los valores finales vienen prellenados con los congelados al
// aprobar, pero el asesor puede corregirlos. El servidor valida; aquí solo se muestran errores.
export function FormularioConstitucion({
  valores,
  registrar,
}: {
  valores: ValoresCongelados;
  registrar: (datos: unknown) => Promise<ResultadoConstitucion>;
}) {
  const router = useRouter();
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [resumen, setResumen] = useState<string | null>(null);
  const [enviando, startTransition] = useTransition();

  function enfocarPrimerInvalido(campos: Record<string, string>) {
    const primero = CAMPOS.find((campo) => campos[campo]);
    if (primero) document.getElementById(primero)?.focus();
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const texto = (campo: string) => String(datos.get(campo) ?? "");
    const entrada = {
      numeroCdt: texto("numeroCdt"),
      valor: Number(texto("valor")),
      // Se acepta coma decimal, como la escribe el asesor en Colombia.
      tasaEa: texto("tasaEa").replace(",", "."),
      fechaApertura: texto("fechaApertura"),
      fechaVenc: texto("fechaVenc"),
    };
    startTransition(async () => {
      const resultado = await registrar(entrada);
      if (resultado.ok) {
        setErrores({});
        setResumen(null);
        router.refresh();
        return;
      }
      const campos = resultado.error.fields ?? {};
      setErrores(campos);
      setResumen(resultado.error.message);
      enfocarPrimerInvalido(campos);
    });
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
      {resumen ? (
        <p role="alert" className="text-destructive sm:col-span-2">
          {resumen}
        </p>
      ) : null}

      <CampoTexto id="numeroCdt" etiqueta="Número del CDT" valor="" error={errores.numeroCdt} />
      <CampoTexto
        id="valor"
        etiqueta="Valor constituido (pesos)"
        tipo="number"
        modo="numeric"
        valor={valores.valor === null ? "" : String(valores.valor)}
        error={errores.valor}
      />
      <CampoTexto
        id="tasaEa"
        etiqueta="Tasa efectiva anual (%)"
        modo="decimal"
        valor={valores.tasaEa ?? ""}
        ayuda="Ejemplo: 10.5000"
        error={errores.tasaEa}
      />
      <CampoTexto
        id="fechaApertura"
        etiqueta="Fecha de apertura"
        tipo="date"
        valor={valores.fechaApertura ?? ""}
        error={errores.fechaApertura}
      />
      <CampoTexto
        id="fechaVenc"
        etiqueta="Fecha de vencimiento"
        tipo="date"
        valor={valores.fechaVenc ?? ""}
        error={errores.fechaVenc}
      />

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={enviando}
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card disabled:opacity-60 motion-reduce:transition-none"
        >
          {enviando ? "Registrando…" : "Registrar constitución"}
        </button>
      </div>
    </form>
  );
}

// Campo con etiqueta visible, ayuda y error junto al control (aria-describedby).
function CampoTexto({
  id,
  etiqueta,
  valor,
  tipo = "text",
  modo,
  ayuda,
  error,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  tipo?: "text" | "number" | "date";
  modo?: "numeric" | "decimal";
  ayuda?: string;
  error?: string;
}) {
  const describedBy = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        inputMode={modo}
        defaultValue={valor}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className="min-h-11 rounded-lg border border-input bg-card px-3 text-base"
      />
      {ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm text-muted-foreground">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
