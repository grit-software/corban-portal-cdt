import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { rateLimits } from "@/server/db/schema";

// Límite de tasa por clave con ventana fija (tabla rate_limits). Atómico: una sola sentencia
// upsert, así dos peticiones simultáneas no pueden saltarse el límite.
export async function consumirLimite(
  clave: string,
  limite: number,
  ventanaSegundos: number,
): Promise<{ permitido: boolean; reintentarEn: number }> {
  const ahora = new Date();
  const inicioVentana = new Date(ahora.getTime() - ventanaSegundos * 1000);
  const [fila] = await getDb()
    .insert(rateLimits)
    .values({ clave, conteo: 1, ventanaInicio: ahora })
    .onConflictDoUpdate({
      target: rateLimits.clave,
      set: {
        conteo: sql`case when ${rateLimits.ventanaInicio} < ${inicioVentana.toISOString()}::timestamptz then 1 else ${rateLimits.conteo} + 1 end`,
        ventanaInicio: sql`case when ${rateLimits.ventanaInicio} < ${inicioVentana.toISOString()}::timestamptz then ${ahora.toISOString()}::timestamptz else ${rateLimits.ventanaInicio} end`,
      },
    })
    .returning({ conteo: rateLimits.conteo, ventanaInicio: rateLimits.ventanaInicio });

  if (!fila) {
    return { permitido: true, reintentarEn: 0 };
  }
  const finVentana = fila.ventanaInicio.getTime() + ventanaSegundos * 1000;
  return {
    permitido: fila.conteo <= limite,
    reintentarEn: Math.max(0, Math.ceil((finVentana - ahora.getTime()) / 1000)),
  };
}
