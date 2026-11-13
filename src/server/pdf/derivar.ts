import { valorEnLetras } from "@/server/condiciones/en-letras";
import { etiqueta } from "@/lib/datos/catalogos";
import { formatoMiles, tasaTexto } from "@/lib/datos/formato";

// derivarDatosPdf (contratos.md §5): deriva del formulario y de los valores congelados al aprobar.
// Nunca recalcula tasa ni vencimiento: esos vienen congelados.

export type Congelado = {
  valor: number;
  plazoDias: number;
  periodicidad: string;
  tasaEa: string;
  fechaApertura: string;
  fechaVenc: string;
};

export type DatosPdf = Record<string, string | number>;

const numero = (v: string | undefined): number => {
  const n = Number.parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? 0 : n;
};

export function derivarDatosPdf(datos: Record<string, string>, congelado: Congelado): DatosPdf {
  const dias = congelado.plazoDias;
  const ingresos = numero(datos.ingresos);
  const otros = numero(datos.otros_ingresos);
  const activos = numero(datos.activos);
  const pasivos = numero(datos.pasivos);

  const D: DatosPdf = { ...datos };
  D.valor = congelado.valor;
  D.valor_letras = valorEnLetras(congelado.valor);
  D.fecha_apertura = congelado.fechaApertura;
  D.fecha_venc = congelado.fechaVenc;
  D.plazo_dias = String(dias);
  D.plazo_meses = Math.round(dias / 30);
  D.plazo_txt = `${dias} días`;
  D.tasa_ea = tasaTexto(congelado.tasaEa);
  D.periodicidad = congelado.periodicidad;
  D.periodicidad_txt =
    congelado.periodicidad === "vencimiento"
      ? "Al vencimiento"
      : etiqueta("periodicidad", congelado.periodicidad);
  D.nombre_completo = [datos.nombre1, datos.nombre2, datos.apellido1, datos.apellido2]
    .filter(Boolean)
    .join(" ");
  D.lugar_nac = [datos.nac_ciudad, datos.nac_pais].filter(Boolean).join(", ");
  D.ciudad_depto_res = [datos.ciudad_res, datos.depto_res].filter(Boolean).join(", ");
  D.ciudad_depto_trab = [datos.ciudad_trab, datos.depto_trab].filter(Boolean).join(", ");
  D.contrato_txt = datos.contrato ? etiqueta("contrato", datos.contrato) : "";
  D.cta_tipo_txt = datos.cta_tipo ? etiqueta("cta_tipo", datos.cta_tipo) : "";
  D.total_ingresos = ingresos + otros || "";
  D.patrimonio = activos || pasivos ? activos - pasivos : "";
  D.ingresos = ingresos || "";
  D.otros_ingresos = otros || "";
  D.egresos = numero(datos.egresos) || "";
  D.activos = activos || "";
  D.pasivos = pasivos || "";
  return D;
}

// Formato de miles para los campos «money» del mapeo.
export function dinero(valor: string | number | undefined): string {
  return formatoMiles(Number(valor ?? 0));
}
