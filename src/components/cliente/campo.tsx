"use client";

import { type Control, Controller, type RefCallBack } from "react-hook-form";
import { CATALOGOS } from "@/lib/datos/catalogos";
import { formatoMiles } from "@/lib/datos/formato";
import type { CampoUI } from "@/lib/datos/pasos";

// Campo de formulario de los pasos del asistente. Etiqueta visible, error en texto junto al
// campo (aria-describedby) y objetivo táctil de 44 px (ui.md).
export function Campo({
  campo,
  control,
  error,
}: {
  campo: CampoUI;
  control: Control<Record<string, string>>;
  error?: string;
}) {
  const id = `campo-${campo.nombre}`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {campo.etiqueta}
        {campo.requerido ? <span className="text-destructive"> *</span> : null}
      </label>
      <Controller
        name={campo.nombre}
        control={control}
        render={({ field }) => (
          <Entrada
            id={id}
            campo={campo}
            valor={field.value ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            innerRef={field.ref}
            descripcion={error ? errorId : undefined}
            invalido={Boolean(error)}
          />
        )}
      />
      {error ? (
        <p id={errorId} className="text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const CLASE_INPUT =
  "min-h-11 rounded-lg border border-input bg-card px-3 text-base text-foreground motion-reduce:transition-none";

function Entrada({
  id,
  campo,
  valor,
  onChange,
  onBlur,
  innerRef,
  descripcion,
  invalido,
}: {
  id: string;
  campo: CampoUI;
  valor: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  innerRef: RefCallBack;
  descripcion?: string;
  invalido: boolean;
}) {
  // ref: react-hook-form lo usa para llevar el foco al primer campo inválido.
  const comun = {
    id,
    name: campo.nombre,
    ref: innerRef,
    "aria-describedby": descripcion,
    "aria-invalid": invalido || undefined,
    onBlur,
  };

  if (campo.tipo === "catalogo" && campo.catalogo) {
    return (
      <select
        {...comun}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className={CLASE_INPUT}
      >
        <option value="">Elige una opción</option>
        {CATALOGOS[campo.catalogo].map(([v, etiqueta]) => (
          <option key={v} value={v}>
            {etiqueta}
          </option>
        ))}
      </select>
    );
  }

  if (campo.tipo === "dinero") {
    return (
      <>
        <input
          {...comun}
          inputMode="numeric"
          autoComplete="off"
          value={formatoMiles(Number(valor))}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className={CLASE_INPUT}
        />
        <span className="text-sm text-muted-foreground">
          Escribe solo números. Se muestran con puntos.
        </span>
      </>
    );
  }

  if (campo.tipo === "digitos") {
    return (
      <input
        {...comun}
        inputMode="numeric"
        value={valor}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className={CLASE_INPUT}
      />
    );
  }

  const tipo = campo.tipo === "fecha" ? "date" : campo.tipo === "correo" ? "email" : "text";
  return (
    <input
      {...comun}
      type={tipo}
      autoComplete={campo.tipo === "correo" ? "email" : undefined}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={CLASE_INPUT}
    />
  );
}
