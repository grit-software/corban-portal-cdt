"use client";

import { useQuery } from "@tanstack/react-query";
import { type Control, Controller } from "react-hook-form";
import { etiqueta } from "@/lib/datos/catalogos";
import { tasaTexto } from "@/lib/datos/formato";
import type { CampoUI } from "@/lib/datos/pasos";
import { llamarApi } from "./api.ts";

// Opción que devuelve GET /api/v1/condiciones/opciones (solo plazo, periodicidad y tasa).
type Opcion = { plazoDias: number; periodicidad: string; tasaEa: string };

// Plazos y periodicidades de la entidad, según el valor elegido. Nunca se inventa una tasa.
export function CampoCondicion({
  campo,
  control,
  error,
  entidadId,
  valor,
  plazo,
  plazoEnMeses,
}: {
  campo: CampoUI;
  control: Control<Record<string, string>>;
  error?: string;
  entidadId: string;
  valor: string;
  plazo: string;
  plazoEnMeses: boolean;
}) {
  const valorListo = /^\d+$/.test(valor) && Number(valor) > 0;
  const consulta = useQuery({
    queryKey: ["opciones", entidadId, valor],
    enabled: valorListo,
    queryFn: () =>
      llamarApi<Opcion[]>(
        "GET",
        `/api/v1/condiciones/opciones?entidadId=${encodeURIComponent(entidadId)}&valor=${valor}`,
      ),
  });

  const opciones = consulta.data?.ok ? consulta.data.data : [];
  const titulo = (
    <span id={`titulo-${campo.nombre}`} className="font-medium">
      {campo.etiqueta}
      {campo.requerido ? <span className="text-destructive"> *</span> : null}
    </span>
  );

  if (!valorListo) {
    return (
      <div className="flex flex-col gap-2">
        {titulo}
        <p className="text-muted-foreground">Escribe el valor a invertir para ver las opciones.</p>
      </div>
    );
  }
  if (consulta.isPending) {
    return (
      <div className="flex flex-col gap-2" role="status">
        {titulo}
        <p className="text-muted-foreground">Buscando las tasas vigentes…</p>
      </div>
    );
  }
  if (!consulta.data?.ok) {
    return (
      <div className="flex flex-col gap-2">
        {titulo}
        <p role="alert" className="text-destructive">
          {consulta.data?.error.message ?? "No pudimos cargar las opciones."}
        </p>
      </div>
    );
  }

  const elegibles =
    campo.tipo === "plazo"
      ? [...new Set(opciones.map((o) => o.plazoDias))].sort((a, b) => a - b)
      : opciones.filter((o) => String(o.plazoDias) === plazo);

  if (elegibles.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        {titulo}
        <p className="text-muted-foreground">
          {campo.tipo === "plazo"
            ? "No hay plazos disponibles para ese valor en esta entidad."
            : "Elige primero un plazo."}
        </p>
      </div>
    );
  }

  return (
    <Controller
      name={campo.nombre}
      control={control}
      render={({ field }) => (
        <fieldset className="flex flex-col gap-2">
          <legend className="font-medium">
            {campo.etiqueta}
            {campo.requerido ? <span className="text-destructive"> *</span> : null}
          </legend>
          <div className="flex flex-wrap gap-2">
            {campo.tipo === "plazo"
              ? (elegibles as number[]).map((dias) => (
                  <Chip
                    key={dias}
                    nombre={campo.nombre}
                    marcado={field.value === String(dias)}
                    onClick={() => field.onChange(String(dias))}
                    texto={plazoEnMeses ? `${Math.round(dias / 30)} meses` : `${dias} días`}
                  />
                ))
              : (elegibles as Opcion[]).map((o) => (
                  <Chip
                    key={o.periodicidad}
                    nombre={campo.nombre}
                    marcado={field.value === o.periodicidad}
                    onClick={() => field.onChange(o.periodicidad)}
                    texto={`${etiqueta("periodicidad", o.periodicidad)} · ${tasaTexto(o.tasaEa)} % E.A.`}
                  />
                ))}
          </div>
          {error ? (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </fieldset>
      )}
    />
  );
}

// Opción tipo chip: un radio nativo oculto dentro de una etiqueta. El nombre accesible es el texto.
function Chip({
  nombre,
  marcado,
  onClick,
  texto,
}: {
  nombre: string;
  marcado: boolean;
  onClick: () => void;
  texto: string;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center rounded-lg border px-4 text-base has-[:focus-visible]:outline-2 motion-reduce:transition-none ${
        marcado
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card text-foreground"
      }`}
    >
      <input type="radio" name={nombre} checked={marcado} onChange={onClick} className="sr-only" />
      {texto}
    </label>
  );
}
