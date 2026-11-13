import { getActor } from "@/server/auth/actor";
import { ErrorDominio } from "@/server/authz/errores";
import { respuestaError } from "@/server/authz/respuestas";
import type { Dias, FiltrosReporte } from "@/server/reportes/consultas";
import { type NombreReporte, exportarXlsx } from "@/server/reportes/exportar";

export const dynamic = "force-dynamic";

const REPORTES: NombreReporte[] = ["inversion", "vencimientos", "solicitudes"];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function filtrosDesde(url: URL): FiltrosReporte {
  const desde = url.searchParams.get("desde") ?? undefined;
  const hasta = url.searchParams.get("hasta") ?? undefined;
  if ((desde && !FECHA.test(desde)) || (hasta && !FECHA.test(hasta))) {
    throw new ErrorDominio("VALIDACION", "Las fechas deben tener formato yyyy-mm-dd", {
      fecha: "Usa el formato yyyy-mm-dd",
    });
  }
  return {
    desde,
    hasta,
    entidadId: url.searchParams.get("entidadId") ?? undefined,
    asesorId: url.searchParams.get("asesorId") ?? undefined,
  };
}

function diasDesde(url: URL): Dias {
  const dias = Number(url.searchParams.get("dias") ?? 30);
  if (dias !== 30 && dias !== 60 && dias !== 90) {
    throw new ErrorDominio("VALIDACION", "Los días deben ser 30, 60 o 90", {
      dias: "Elige 30, 60 o 90",
    });
  }
  return dias;
}

// Descarga de un reporte en .xlsx. Filtros y días por query string.
export async function GET(
  request: Request,
  context: { params: Promise<{ reporte: string }> },
): Promise<Response> {
  try {
    const actor = await getActor(request.headers);
    if (!actor) {
      throw new ErrorDominio("NO_AUTENTICADO", "Ingresa para continuar");
    }
    const { reporte } = await context.params;
    if (!REPORTES.includes(reporte as NombreReporte)) {
      throw new ErrorDominio("NO_ENCONTRADO", "Reporte inexistente");
    }
    const url = new URL(request.url);
    const bytes = await exportarXlsx(
      actor,
      reporte as NombreReporte,
      filtrosDesde(url),
      diasDesde(url),
    );
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": TIPO_XLSX,
        "content-disposition": `attachment; filename="reporte-${reporte}.xlsx"`,
      },
    });
  } catch (error) {
    return respuestaError(error);
  }
}
