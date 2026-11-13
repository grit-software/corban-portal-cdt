import { ErrorDominio } from "@/server/authz/errores";
import { respuestaError } from "@/server/authz/respuestas";
import { existeStaffPorEmail } from "./staff.ts";
import { consumirLimite } from "./limite.ts";

const RUTA_ENVIO_OTP = "/email-otp/send-verification-otp";

// Filtro previo al envío de OTP. Devuelve una respuesta de bloqueo, o null para seguir.
export async function revisarEnvioOtp(request: Request): Promise<Response | null> {
  if (!new URL(request.url).pathname.endsWith(RUTA_ENVIO_OTP)) {
    return null;
  }
  const cuerpo = (await request
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  if (typeof cuerpo?.email !== "string") {
    return null; // cuerpo inválido: better-auth responde su propio error de validación
  }
  const correo = cuerpo.email.trim().toLowerCase();

  // El staff entra solo con Microsoft: nunca recibe un código por correo.
  if (await existeStaffPorEmail(correo)) {
    return respuestaError(
      new ErrorDominio("USAR_MICROSOFT", "Ingresa con tu cuenta de Microsoft corporativa"),
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconocida";
  const porCorreo = await consumirLimite(`otp:${correo}`, 5, 900);
  const porIp = await consumirLimite(`otp-ip:${ip}`, 20, 900);
  const reintentarEn = Math.max(porCorreo.reintentarEn, porIp.reintentarEn);
  if (!porCorreo.permitido || !porIp.permitido) {
    const respuesta = respuestaError(
      new ErrorDominio("LIMITE_EXCEDIDO", "Demasiados intentos. Espera e intenta de nuevo."),
    );
    respuesta.headers.set("Retry-After", String(reintentarEn));
    return respuesta;
  }
  return null;
}
