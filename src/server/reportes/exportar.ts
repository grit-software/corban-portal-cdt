import ExcelJS from "exceljs";
import type { Actor } from "@/server/authz/actor";
import {
  type Dias,
  type FiltrosReporte,
  inversion,
  resumenSolicitudes,
  vencimientos,
} from "@/server/reportes/consultas";

// Exportación .xlsx de los reportes (E3-T3), con encabezados en español. Una sola hoja.

export type NombreReporte = "inversion" | "vencimientos" | "solicitudes";

export async function exportarXlsx(
  actor: Actor,
  reporte: NombreReporte,
  filtros: FiltrosReporte = {},
  dias: Dias = 30,
): Promise<Uint8Array> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Reporte");

  if (reporte === "inversion") {
    const { detalle } = await inversion(actor, filtros);
    hoja.addRow(["Entidad", "Asesor", "Total invertido (COP)"]);
    for (const f of detalle) {
      hoja.addRow([f.entidadNombre, f.asesorNombre ?? "Sin asesor", f.total]);
    }
  } else if (reporte === "vencimientos") {
    const filas = await vencimientos(actor, dias, filtros);
    hoja.addRow(["Cliente", "Entidad", "Número CDT", "Valor (COP)", "Vencimiento"]);
    for (const f of filas) {
      hoja.addRow([f.cliente, f.entidad, f.numeroCdt, f.valor, f.vencimiento]);
    }
  } else {
    const resumen = await resumenSolicitudes(actor, filtros);
    hoja.addRow(["Estado", "Cantidad", "Promedio de días"]);
    for (const f of resumen.porEstado) {
      const promedio = f.estado === "cdt_constituido" ? resumen.promedioDias : null;
      hoja.addRow([f.estado, f.cantidad, promedio === null ? null : Number(promedio.toFixed(1))]);
    }
  }

  return new Uint8Array(await libro.xlsx.writeBuffer());
}
