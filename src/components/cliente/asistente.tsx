"use client";

import type { ReactNode } from "react";
import type { Paso } from "@/lib/datos/esquemas";
import { ORDEN_ASISTENTE, type PasoAsistente } from "@/lib/datos/pasos";
import { PasoCdt } from "./pasos/paso-cdt.tsx";
import { PasoFinanciera } from "./pasos/paso-financiera.tsx";
import { PasoLaboral } from "./pasos/paso-laboral.tsx";
import { PasoPago } from "./pasos/paso-pago.tsx";
import { PasoPersonal } from "./pasos/paso-personal.tsx";
import { PasoResumen } from "./paso-resumen.tsx";

// Elige el paso según la URL y pasa los datos guardados de la solicitud.
export function Asistente({
  solicitudId,
  paso,
  datos,
  entidad,
}: {
  solicitudId: string;
  paso: PasoAsistente;
  datos: Record<string, string>;
  entidad: { id: string; nombre: string; plazoEnMeses: boolean };
}) {
  const indice = ORDEN_ASISTENTE.indexOf(paso);
  const anterior = indice > 0 ? (ORDEN_ASISTENTE[indice - 1] ?? null) : null;
  const siguiente = ORDEN_ASISTENTE[indice + 1] ?? "resumen";

  if (paso === "resumen") {
    return (
      <PasoResumen
        solicitudId={solicitudId}
        datos={datos}
        entidadNombre={entidad.nombre}
        anterior={anterior ?? "pago"}
      />
    );
  }

  const comun = {
    solicitudId,
    datosIniciales: datos,
    entidad: { id: entidad.id, plazoEnMeses: entidad.plazoEnMeses },
    anterior,
    siguiente,
  };
  const porPaso: Record<Paso, ReactNode> = {
    cdt: <PasoCdt {...comun} />,
    personal: <PasoPersonal {...comun} />,
    laboral: <PasoLaboral {...comun} />,
    financiera: <PasoFinanciera {...comun} />,
    pago: <PasoPago {...comun} />,
  };
  return porPaso[paso];
}
