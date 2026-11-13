"use client";

import { useState } from "react";
import { guardarPerfilAccion } from "@/app/(staff)/coordinador/importar/acciones";

// Importador de Excel (E3-T2): subir → mapear columnas → vista previa → confirmar. Solo habla con
// las rutas /api/staff/importaciones y con la server action de perfiles; no importa src/server.

type PerfilVista = { id: string; nombre: string; mapeo: Record<string, string> };
type ErrorApi = { error?: { message?: string; fields?: Record<string, string> } };
type Vista = {
  totalFilas: number;
  validas: number;
  conErrores: number;
  filas: { numero: number; errores: string[] }[];
};
type Resumen = {
  cargaId: string;
  creadas: number;
  actualizadas: number;
  sinCambios: number;
  rechazadas: number;
  rechazosDisponibles: boolean;
};

const DESTINOS: { valor: string; etiqueta: string }[] = [
  { valor: "ignorar", etiqueta: "Ignorar" },
  { valor: "cliente.tipo_doc", etiqueta: "Tipo de documento" },
  { valor: "cliente.num_doc", etiqueta: "Número de documento" },
  { valor: "cliente.nombres", etiqueta: "Nombres" },
  { valor: "cliente.email", etiqueta: "Correo" },
  { valor: "cliente.celular", etiqueta: "Celular" },
  { valor: "cdt.entidad", etiqueta: "Entidad" },
  { valor: "cdt.numero_cdt", etiqueta: "Número de CDT" },
  { valor: "cdt.valor", etiqueta: "Valor (COP)" },
  { valor: "cdt.tasa_ea", etiqueta: "Tasa efectiva anual" },
  { valor: "cdt.fecha_apertura", etiqueta: "Fecha de apertura" },
  { valor: "cdt.fecha_venc", etiqueta: "Fecha de vencimiento" },
  { valor: "cdt.periodicidad", etiqueta: "Periodicidad" },
  { valor: "cdt.estado", etiqueta: "Estado del CDT" },
];

async function responder<T>(respuesta: Response): Promise<T> {
  const cuerpo = (await respuesta.json()) as T & ErrorApi;
  if (!respuesta.ok) {
    throw new Error(cuerpo.error?.message ?? "No se pudo completar la acción");
  }
  return cuerpo;
}

export function ImportadorExcel({ perfiles }: { perfiles: PerfilVista[] }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [encabezados, setEncabezados] = useState<string[]>([]);
  const [mapeo, setMapeo] = useState<Record<string, string>>({});
  const [nombrePerfil, setNombrePerfil] = useState("");
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  function formulario(): FormData {
    const datos = new FormData();
    if (archivo) datos.append("archivo", archivo);
    datos.append("mapeo", JSON.stringify(mapeo));
    return datos;
  }

  async function elegirArchivo(nuevo: File | null) {
    setArchivo(nuevo);
    setVista(null);
    setResumen(null);
    setPerfilId(null);
    setError(null);
    setEncabezados([]);
    setMapeo({});
    if (!nuevo) return;
    setOcupado(true);
    try {
      const datos = new FormData();
      datos.append("archivo", nuevo);
      const { encabezados: lista } = await responder<{ encabezados: string[] }>(
        await fetch("/api/staff/importaciones/encabezados", { method: "POST", body: datos }),
      );
      setEncabezados(lista);
      setMapeo(Object.fromEntries(lista.map((h) => [h, "ignorar"])));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo");
    } finally {
      setOcupado(false);
    }
  }

  function aplicarPerfil(id: string) {
    const perfil = perfiles.find((p) => p.id === id);
    setPerfilId(id);
    setNombrePerfil(perfil?.nombre ?? "");
    if (perfil) {
      setMapeo((actual) =>
        Object.fromEntries(encabezados.map((h) => [h, perfil.mapeo[h] ?? actual[h] ?? "ignorar"])),
      );
    }
  }

  async function guardarPerfil(): Promise<string> {
    const nombre = nombrePerfil.trim();
    if (!nombre) throw new Error("Escribe un nombre para el perfil");
    const guardado = await guardarPerfilAccion(nombre, mapeo);
    setPerfilId(guardado.id);
    return guardado.id;
  }

  async function previsualizar() {
    setError(null);
    setOcupado(true);
    try {
      setVista(
        await responder<Vista>(
          await fetch("/api/staff/importaciones/vista-previa", {
            method: "POST",
            body: formulario(),
          }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo hacer la vista previa");
    } finally {
      setOcupado(false);
    }
  }

  async function confirmar() {
    setError(null);
    setOcupado(true);
    try {
      const id = perfilId ?? (await guardarPerfil());
      const datos = formulario();
      datos.append("perfilId", id);
      setResumen(
        await responder<Resumen>(
          await fetch("/api/staff/importaciones/confirmar", { method: "POST", body: datos }),
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar la importación");
    } finally {
      setOcupado(false);
    }
  }

  const hayMapeoValido =
    Object.values(mapeo).includes("cliente.num_doc") &&
    Object.values(mapeo).includes("cliente.tipo_doc");

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p role="alert" className="rounded-lg border border-destructive p-3 text-destructive">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">1. Archivo</h2>
        <label className="flex flex-col gap-1">
          <span>Archivo Excel (.xlsx, máximo 5 MB)</span>
          <input
            type="file"
            accept=".xlsx"
            disabled={ocupado}
            onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
            className="min-h-11"
          />
        </label>
      </section>

      {encabezados.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">2. Columnas</h2>
          {perfiles.length > 0 ? (
            <label className="flex flex-col gap-1">
              <span>Perfil guardado</span>
              <select
                className="min-h-11 rounded-lg border border-border px-3"
                value={perfilId ?? ""}
                onChange={(e) => aplicarPerfil(e.target.value)}
              >
                <option value="">Sin perfil</option>
                {perfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {encabezados.map((h) => (
            <label key={h} className="flex flex-col gap-1">
              <span>{h}</span>
              <select
                className="min-h-11 rounded-lg border border-border px-3"
                value={mapeo[h] ?? "ignorar"}
                onChange={(e) => setMapeo((m) => ({ ...m, [h]: e.target.value }))}
              >
                {DESTINOS.map((d) => (
                  <option key={d.valor} value={d.valor}>
                    {d.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1">
            <span>Nombre del perfil</span>
            <input
              className="min-h-11 rounded-lg border border-border px-3"
              value={nombrePerfil}
              onChange={(e) => setNombrePerfil(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={ocupado || !hayMapeoValido}
            onClick={previsualizar}
            className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50"
          >
            Ver vista previa
          </button>
          {!hayMapeoValido ? (
            <p className="text-sm text-muted-foreground">
              Asigna las columnas de tipo y número de documento para continuar.
            </p>
          ) : null}
        </section>
      ) : null}

      {vista ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">3. Vista previa</h2>
          <p>
            {vista.totalFilas} filas · {vista.validas} válidas · {vista.conErrores} con errores
          </p>
          {vista.filas.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {vista.filas.map((f) => (
                <li key={f.numero} className="py-2 text-sm">
                  Fila {f.numero}: {f.errores.join(", ")}
                </li>
              ))}
            </ul>
          ) : null}
          <button
            type="button"
            disabled={ocupado || vista.validas === 0}
            onClick={confirmar}
            className="min-h-11 rounded-lg bg-primary px-4 text-primary-foreground disabled:opacity-50"
          >
            Confirmar importación
          </button>
        </section>
      ) : null}

      {resumen ? (
        <section className="flex flex-col gap-2" aria-live="polite">
          <h2 className="text-lg font-semibold">Resumen</h2>
          <p>
            Creadas {resumen.creadas} · actualizadas {resumen.actualizadas} · sin cambios{" "}
            {resumen.sinCambios} · rechazadas {resumen.rechazadas}
          </p>
          {resumen.rechazosDisponibles ? (
            <a
              href={`/api/staff/importaciones/${resumen.cargaId}/rechazos`}
              className="min-h-11 text-primary underline"
            >
              Descargar filas rechazadas
            </a>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
