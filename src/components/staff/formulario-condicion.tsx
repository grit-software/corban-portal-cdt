"use client";

import { type FormEvent, useState } from "react";
import { guardarCondicion } from "@/app/(staff)/coordinador/condiciones/acciones";

const PERIODICIDADES = [
  ["vencimiento", "Al vencimiento"],
  ["mensual", "Mensual"],
  ["bimestral", "Bimestral"],
  ["trimestral", "Trimestral"],
  ["semestral", "Semestral"],
  ["anual", "Anual"],
] as const;

// Alta de una condición de tasa. Los errores se muestran junto al campo y en un resumen.
export function FormularioCondicion({
  entidades,
}: {
  entidades: { id: string; nombre: string }[];
}) {
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [resumen, setResumen] = useState<string | null>(null);
  const [guardada, setGuardada] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const numero = (campo: string) => Number(datos.get(campo));
    const texto = (campo: string) => String(datos.get(campo) ?? "");
    const hasta = texto("vigenteHasta");
    const maximo = texto("montoMax");
    const resultado = await guardarCondicion(null, {
      entidadId: texto("entidadId"),
      plazoDias: numero("plazoDias"),
      montoMin: numero("montoMin"),
      montoMax: maximo === "" ? null : Number(maximo),
      periodicidad: texto("periodicidad"),
      tasaEa: texto("tasaEa"),
      vigenteDesde: texto("vigenteDesde"),
      vigenteHasta: hasta === "" ? null : hasta,
    });
    setGuardada(resultado.ok);
    setErrores(resultado.ok ? {} : (resultado.error.fields ?? {}));
    setResumen(resultado.ok ? null : resultado.error.message);
  }

  if (guardada) {
    return (
      <p className="text-success-strong">Condición guardada. Quedó registrada en la auditoría.</p>
    );
  }

  return (
    <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-2" noValidate>
      {resumen ? (
        <p role="alert" className="text-destructive sm:col-span-2">
          {resumen}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label htmlFor="entidadId" className="text-sm font-medium">
          Entidad
        </label>
        <select
          id="entidadId"
          name="entidadId"
          required
          className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {entidades.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        {errores.entidadId ? <p className="text-sm text-destructive">{errores.entidadId}</p> : null}
      </div>
      <Campo id="plazoDias" etiqueta="Plazo (días)" tipo="number" error={errores.plazoDias} />
      <Campo id="montoMin" etiqueta="Monto mínimo (pesos)" tipo="number" error={errores.montoMin} />
      <Campo
        id="montoMax"
        etiqueta="Monto máximo (vacío = sin tope)"
        tipo="number"
        error={errores.montoMax}
        requerido={false}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="periodicidad" className="text-sm font-medium">
          Periodicidad
        </label>
        <select
          id="periodicidad"
          name="periodicidad"
          required
          className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm"
        >
          {PERIODICIDADES.map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </div>
      <Campo id="tasaEa" etiqueta="Tasa E.A. (p. ej. 10.5000)" error={errores.tasaEa} />
      <Campo id="vigenteDesde" etiqueta="Vigente desde (aaaa-mm-dd)" error={errores.vigenteDesde} />
      <Campo
        id="vigenteHasta"
        etiqueta="Vigente hasta (vacío = sin fin)"
        error={errores.vigenteHasta}
        requerido={false}
      />
      <button
        type="submit"
        className="min-h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground sm:col-span-2 sm:justify-self-start"
      >
        Guardar condición
      </button>
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  tipo = "text",
  requerido = true,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  tipo?: string;
  requerido?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        name={id}
        type={tipo}
        required={requerido}
        aria-describedby={error ? `${id}-error` : undefined}
        className="min-h-10 rounded-lg border border-input bg-card px-3 text-sm"
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
