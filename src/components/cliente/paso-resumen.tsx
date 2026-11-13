"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { etiqueta } from "@/lib/datos/catalogos";
import { OBLIGATORIAS } from "@/lib/datos/esquemas";
import { PASOS_UI, pasoDelCampo } from "@/lib/datos/pasos";
import { llamarApi } from "./api.ts";

type Datos = Record<string, string>;

// Resumen y envío. Lista lo que falta con un enlace al paso correspondiente, y envía a validación.
export function PasoResumen({
  solicitudId,
  datos,
  entidadNombre,
  anterior,
}: {
  solicitudId: string;
  datos: Datos;
  entidadNombre: string;
  anterior: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [faltantes, setFaltantes] = useState<Record<string, string>>({});

  const pendientes = OBLIGATORIAS.filter((clave) => !datos[clave]);

  async function enviar() {
    setEnviando(true);
    setMensaje(null);
    setFaltantes({});
    const resultado = await llamarApi("POST", `/api/v1/solicitudes/${solicitudId}/enviar`);
    setEnviando(false);
    if (resultado.ok) {
      // Sin router.refresh(): cancelaría la navegación. El detalle se pinta fresco en el servidor.
      router.push(`/mi-cuenta/solicitudes/${solicitudId}`);
      return;
    }
    setMensaje(resultado.error.message);
    setFaltantes(resultado.error.fields ?? {});
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Revisa tu solicitud</h1>
      <p className="text-muted-foreground">
        Vas a abrir un CDT con <strong className="text-foreground">{entidadNombre}</strong>.
      </p>

      {pendientes.length > 0 ? (
        <div className="rounded-lg border border-destructive p-4" role="alert">
          <p className="font-medium text-destructive">Faltan datos obligatorios:</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {pendientes.map((clave) => (
              <li key={clave}>
                <EnlacePaso clave={clave} solicitudId={solicitudId} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {mensaje ? (
        <div role="alert" className="flex flex-col gap-2 text-destructive">
          <p>{mensaje}</p>
          {Object.keys(faltantes).length > 0 ? (
            <ul className="list-disc pl-5">
              {Object.entries(faltantes).map(([clave, texto]) => (
                <li key={clave}>
                  <EnlacePaso clave={clave} solicitudId={solicitudId} /> · {texto}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <dl className="grid gap-3 rounded-lg bg-card p-4 shadow-card sm:grid-cols-2">
        {Object.entries(datos)
          .filter(([, valor]) => valor !== "")
          .map(([clave, valor]) => (
            <div key={clave} className="flex flex-col">
              <dt className="text-sm text-muted-foreground">{etiquetaCampo(clave)}</dt>
              <dd>{valorVisible(clave, valor)}</dd>
            </div>
          ))}
      </dl>

      <nav className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <Link
          href={`/mi-cuenta/solicitudes/${solicitudId}/editar?paso=${anterior}`}
          className="flex min-h-11 items-center justify-center rounded-lg border border-input bg-card px-4 font-medium"
        >
          Anterior
        </Link>
        <button
          type="button"
          onClick={enviar}
          disabled={enviando}
          className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card transition-colors duration-150 hover:bg-primary-dark motion-reduce:transition-none disabled:opacity-60"
        >
          {enviando ? "Enviando…" : "Enviar a validación"}
        </button>
      </nav>
    </section>
  );
}

function EnlacePaso({ clave, solicitudId }: { clave: string; solicitudId: string }) {
  const paso = pasoDelCampo(clave) ?? "cdt";
  const etiquetaCampoTexto = etiquetaCampo(clave);
  return (
    <Link
      href={`/mi-cuenta/solicitudes/${solicitudId}/editar?paso=${paso}`}
      className="min-h-11 py-2 underline"
    >
      {etiquetaCampoTexto} ({PASOS_UI[paso].titulo})
    </Link>
  );
}

function etiquetaCampo(clave: string): string {
  for (const paso of Object.values(PASOS_UI)) {
    const campo = paso.campos.find((c) => c.nombre === clave);
    if (campo) return campo.etiqueta;
  }
  return clave;
}

function valorVisible(clave: string, valor: string): string {
  for (const paso of Object.values(PASOS_UI)) {
    const campo = paso.campos.find((c) => c.nombre === clave);
    if (campo?.tipo === "catalogo" && campo.catalogo) {
      return etiqueta(campo.catalogo, valor);
    }
  }
  return valor;
}
