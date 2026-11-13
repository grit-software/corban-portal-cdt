"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { type Paso, PASOS } from "@/lib/datos/esquemas";
import { PASOS_UI, esquemaFormulario } from "@/lib/datos/pasos";
import { Campo } from "./campo.tsx";
import { CampoCondicion } from "./campo-condicion.tsx";
import { llamarApi } from "./api.ts";

type Valores = Record<string, string>;

// Un paso del asistente: react-hook-form + zodResolver, autoguardado con debounce de 1,5 s,
// «Anterior» y «Siguiente» con guardado, y foco al primer campo inválido.
export function FormularioPaso({
  solicitudId,
  paso,
  datosIniciales,
  entidad,
  anterior,
  siguiente,
}: {
  solicitudId: string;
  paso: Paso;
  datosIniciales: Valores;
  entidad: { id: string; plazoEnMeses: boolean };
  anterior: string | null;
  siguiente: string;
}) {
  const router = useRouter();
  const campos = PASOS_UI[paso].campos;
  const valoresIniciales = Object.fromEntries(
    campos.map((c) => [c.nombre, datosIniciales[c.nombre] ?? ""]),
  );
  const { control, handleSubmit, setError, formState, getValues } = useForm<Valores>({
    resolver: zodResolver(esquemaFormulario(paso)) as never,
    defaultValues: valoresIniciales,
  });
  const [resumen, setResumen] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Valor y plazo vienen del paso del CDT. En los demás pasos no están en el formulario, así que
  // se usan los guardados: las opciones de tasa dependen de ellos.
  const valorDelFormulario = useWatch({ control, name: "valor" });
  const plazoDelFormulario = useWatch({ control, name: "plazo_dias" });
  const valor = valorDelFormulario ?? datosIniciales.valor ?? "";
  const plazo = plazoDelFormulario ?? datosIniciales.plazo_dias ?? "";

  // Guarda los valores del paso con PATCH. Con navegar, lleva al destino tras guardar.
  const guardar = useCallback(
    async (datos: Valores, opciones: { navegar: boolean; destino?: string }): Promise<boolean> => {
      setGuardando(true);
      const resultado = await llamarApi("PATCH", `/api/v1/solicitudes/${solicitudId}`, {
        paso,
        datos: Object.fromEntries(campos.map((c) => [c.nombre, datos[c.nombre] ?? ""])),
      });
      setGuardando(false);
      if (!resultado.ok) {
        if (resultado.error.fields) {
          for (const [nombre, mensaje] of Object.entries(resultado.error.fields)) {
            setError(nombre as never, { message: mensaje });
          }
        }
        setResumen(resultado.error.message);
        return false;
      }
      setResumen(null);
      if (opciones.navegar && opciones.destino) {
        router.push(opciones.destino);
      }
      return true;
    },
    [paso, solicitudId, campos, router, setError],
  );

  // Autoguardado: tras 1,5 s sin cambios se envía lo que hay (sin exigir obligatorias).
  const ultimoGuardado = useRef(JSON.stringify(valoresIniciales));
  const todos = useWatch({ control });
  useEffect(() => {
    const instantanea = JSON.stringify(todos);
    if (instantanea === ultimoGuardado.current) {
      return;
    }
    const temporizador = setTimeout(() => {
      void guardar(getValues(), { navegar: false }).then((ok) => {
        if (ok) {
          ultimoGuardado.current = instantanea;
        }
      });
    }, 1500);
    return () => clearTimeout(temporizador);
  }, [todos, getValues, guardar]);

  const urlPaso = (p: string) => `/mi-cuenta/solicitudes/${solicitudId}/editar?paso=${p}`;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((datos) =>
        guardar(datos, { navegar: true, destino: urlPaso(siguiente) }),
      )}
      className="flex flex-col gap-6"
    >
      <h1 className="text-2xl font-semibold">{PASOS_UI[paso].titulo}</h1>
      {resumen || Object.keys(formState.errors).length > 0 ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-destructive">
          {resumen ?? "Revisa los campos marcados."}
        </p>
      ) : null}

      {campos.map((campo) =>
        campo.tipo === "plazo" || campo.tipo === "periodicidad" ? (
          <CampoCondicion
            key={campo.nombre}
            campo={campo}
            control={control}
            error={formState.errors[campo.nombre]?.message}
            entidadId={entidad.id}
            valor={valor}
            plazo={plazo}
            plazoEnMeses={entidad.plazoEnMeses}
          />
        ) : (
          <Campo
            key={campo.nombre}
            campo={campo}
            control={control}
            error={formState.errors[campo.nombre]?.message}
          />
        ),
      )}

      <nav className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        {anterior ? (
          <button
            type="button"
            disabled={guardando}
            onClick={() => guardar(getValues(), { navegar: true, destino: urlPaso(anterior) })}
            className="min-h-11 rounded-lg border border-input bg-card px-4 font-medium text-foreground disabled:opacity-60"
          >
            Anterior
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          disabled={guardando}
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
        >
          {guardando ? "Guardando…" : "Siguiente"}
        </button>
      </nav>
      <p className="text-sm text-muted-foreground">
        Paso {PASOS.indexOf(paso) + 1} de {PASOS.length}. Tus respuestas se guardan solas.
      </p>
    </form>
  );
}
