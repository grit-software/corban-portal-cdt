"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Carga del formulario firmado: imágenes o PDF, hasta 10 archivos y 15 MB en total.
const MAX_ARCHIVOS = 10;
const MAX_BYTES = 15 * 1024 * 1024;

const SECCIONES_EN_BLANCO =
  "Estas secciones quedan en blanco por diseño: PEP, FATCA/CRS, moneda extranjera, origen de fondos, referencias, cónyuge, firmas y huellas.";

function formatear(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CargaFirmada({ solicitudId }: { solicitudId: string }) {
  const router = useRouter();
  const [archivos, setArchivos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const total = archivos.reduce((suma, a) => suma + a.size, 0);

  function elegir(lista: FileList | null) {
    setError(null);
    const elegidos = Array.from(lista ?? []);
    if (elegidos.length > MAX_ARCHIVOS) {
      setError(`Máximo ${MAX_ARCHIVOS} archivos por carga. Quita algunos e intenta de nuevo.`);
      return;
    }
    if (elegidos.reduce((suma, a) => suma + a.size, 0) > MAX_BYTES) {
      setError("La carga supera los 15 MB en total. Usa fotos de menor tamaño.");
      return;
    }
    setArchivos(elegidos);
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    const datos = new FormData();
    for (const archivo of archivos) datos.append("archivos", archivo);
    const respuesta = await fetch(`/api/v1/solicitudes/${solicitudId}/firmados`, {
      method: "POST",
      body: datos,
    });
    setEnviando(false);
    if (respuesta.ok) {
      setArchivos([]);
      router.refresh();
      return;
    }
    const cuerpo = (await respuesta.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    if (respuesta.status === 413) {
      setError("La carga es demasiado grande. Revisa el número y el tamaño de los archivos.");
    } else if (respuesta.status === 415) {
      setError(
        "Uno de los archivos no es PDF, JPEG ni PNG. Vuelve a tomar la foto o escanea de nuevo.",
      );
    } else {
      setError(cuerpo?.error?.message ?? "No pudimos enviar tu firma. Intenta de nuevo.");
    }
  }

  return (
    <section aria-labelledby="titulo-firma" className="flex flex-col gap-4">
      <h2 id="titulo-firma" className="text-lg font-semibold">
        Sube tu formulario firmado
      </h2>
      <p className="text-muted-foreground">{SECCIONES_EN_BLANCO}</p>
      <label htmlFor="archivos-firma" className="font-medium">
        Archivos (fotos o PDF)
      </label>
      <input
        id="archivos-firma"
        type="file"
        multiple
        accept="image/*,application/pdf"
        capture="environment"
        onChange={(e) => elegir(e.target.files)}
        className="min-h-11 rounded-lg border border-input bg-card px-3 py-2"
      />
      {archivos.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {archivos.map((a) => (
            <li key={`${a.name}-${a.size}`}>
              {a.name} · {formatear(a.size)}
            </li>
          ))}
          <li className="font-medium">Total: {formatear(total)}</li>
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={enviar}
        disabled={archivos.length === 0 || enviando}
        className="min-h-11 rounded-lg bg-primary px-4 font-medium text-primary-foreground shadow-card disabled:opacity-60"
      >
        {enviando ? "Enviando…" : "Enviar firma"}
      </button>
    </section>
  );
}
