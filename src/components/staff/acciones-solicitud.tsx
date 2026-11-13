"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { llamarApi } from "@/components/cliente/api";

type Accion =
  | "aprobar"
  | "devolver"
  | "cancelar"
  | "enviar_entidad"
  | "aceptar_firma"
  | "rechazar_firma";

// Acciones permitidas por estado (contratos.md §3). Cualquier otra combinación no se ofrece.
const ACCIONES_POR_ESTADO: Record<string, Accion[]> = {
  pendiente_validacion: ["aprobar", "devolver", "cancelar"],
  pendiente_firma: ["cancelar"],
  firma_en_revision: ["aceptar_firma", "rechazar_firma", "cancelar"],
  lista_para_enviar: ["enviar_entidad", "cancelar"],
};

// Acciones del asesor sobre la solicitud. Las que piden texto (motivo, observación, fecha) lo
// recogen aquí y se validan en el servidor.
export function AccionesSolicitud({
  solicitudId,
  estado,
}: {
  solicitudId: string;
  estado: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  const [radicado, setRadicado] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const permitidas = ACCIONES_POR_ESTADO[estado] ?? [];

  if (permitidas.length === 0) {
    return <p className="text-muted-foreground">No hay acciones pendientes para esta solicitud.</p>;
  }

  async function ejecutar(accion: Accion) {
    setEnviando(true);
    setMensaje(null);
    const rutas: Record<Accion, { url: string; cuerpo: unknown }> = {
      aprobar: { url: `/api/staff/solicitudes/${solicitudId}/aprobar`, cuerpo: {} },
      devolver: {
        url: `/api/staff/solicitudes/${solicitudId}/devolver`,
        cuerpo: { observacion: texto },
      },
      cancelar: {
        url: `/api/staff/solicitudes/${solicitudId}/cancelar`,
        cuerpo: { motivo: texto },
      },
      enviar_entidad: {
        url: `/api/staff/solicitudes/${solicitudId}/enviar_entidad`,
        cuerpo: { fechaEnvio: fecha, radicado },
      },
      aceptar_firma: { url: `/api/staff/solicitudes/${solicitudId}/firma/aceptar`, cuerpo: {} },
      rechazar_firma: {
        url: `/api/staff/solicitudes/${solicitudId}/firma/rechazar`,
        cuerpo: { motivo: texto },
      },
    };
    const { url, cuerpo } = rutas[accion];
    const resultado = await llamarApi("POST", url, cuerpo);
    setEnviando(false);
    if (!resultado.ok) {
      setMensaje(resultado.error.message);
      return;
    }
    setTexto("");
    router.refresh();
  }

  const etiquetas: Record<Accion, string> = {
    aprobar: "Aprobar",
    devolver: "Devolver al cliente",
    cancelar: "Cancelar solicitud",
    enviar_entidad: "Marcar enviada a la entidad",
    aceptar_firma: "Aceptar firma",
    rechazar_firma: "Rechazar firma",
  };
  const pideTexto = permitidas.some(
    (a) => a === "devolver" || a === "cancelar" || a === "rechazar_firma",
  );

  return (
    <section aria-labelledby="titulo-acciones" className="flex flex-col gap-4">
      <h2 id="titulo-acciones" className="text-lg font-semibold">
        Acciones
      </h2>
      {mensaje ? (
        <p role="alert" className="text-destructive">
          {mensaje}
        </p>
      ) : null}
      {pideTexto ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="texto-accion" className="font-medium">
            Motivo u observación
          </label>
          <textarea
            id="texto-accion"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="min-h-11 rounded-lg border border-input bg-card p-3"
          />
        </div>
      ) : null}
      {permitidas.includes("enviar_entidad") ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">Fecha de envío</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="min-h-11 rounded-lg border border-input bg-card px-3"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">Radicado (opcional)</span>
            <input
              value={radicado}
              onChange={(e) => setRadicado(e.target.value)}
              className="min-h-11 rounded-lg border border-input bg-card px-3"
            />
          </label>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {permitidas.map((accion) => (
          <button
            key={accion}
            type="button"
            disabled={enviando}
            onClick={() => ejecutar(accion)}
            className="min-h-11 rounded-lg border border-input bg-card px-4 font-medium text-foreground disabled:opacity-60"
          >
            {etiquetas[accion]}
          </button>
        ))}
      </div>
    </section>
  );
}
