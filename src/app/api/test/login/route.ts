import { getEnv } from "@/lib/env";
import { ErrorDominio } from "@/server/authz/errores";
import { respuestaError } from "@/server/authz/respuestas";
import { iniciarSesionPorOtp } from "@/server/auth/sesion-prueba";
import { buscarStaffActivoPorEmail } from "@/server/auth/staff";

export const dynamic = "force-dynamic";

// Solo para desarrollo y pruebas: 404 en producción y cuando AUTH_TEST_LOGIN no es 1.
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  if (env.NODE_ENV === "production" || env.AUTH_TEST_LOGIN !== "1") {
    return respuestaError(new ErrorDominio("NO_ENCONTRADO", "No encontrado"));
  }
  try {
    const cuerpo = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const correo = typeof cuerpo?.email === "string" ? cuerpo.email.trim().toLowerCase() : "";
    if (!correo || !(await buscarStaffActivoPorEmail(correo))) {
      return respuestaError(new ErrorDominio("NO_ENCONTRADO", "No encontrado"));
    }
    const respuestaAuth = await iniciarSesionPorOtp(correo);
    const cabeceras = new Headers({ "content-type": "application/json" });
    for (const cookie of respuestaAuth.headers.getSetCookie()) {
      cabeceras.append("set-cookie", cookie);
    }
    return new Response(JSON.stringify({ data: { sesion: "iniciada" } }), {
      status: 200,
      headers: cabeceras,
    });
  } catch (error) {
    return respuestaError(error);
  }
}
