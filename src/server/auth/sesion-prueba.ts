import { getAuth, otpParaPruebas } from "./auth.ts";

// Inicia sesión por OTP sin correo real: pruebas y /api/test/login. Nunca se usa en producción.
export async function iniciarSesionPorOtp(email: string): Promise<Response> {
  const correo = email.trim().toLowerCase();
  const auth = getAuth();
  otpParaPruebas.delete(correo);
  await auth.api.sendVerificationOTP({ body: { email: correo, type: "sign-in" } });
  const otp = otpParaPruebas.get(correo);
  if (!otp) {
    throw new Error("No se generó el código de prueba");
  }
  return auth.api.signInEmailOTP({
    body: { email: correo, otp },
    asResponse: true,
  });
}

// Cookie de sesión ("nombre=valor") lista para la cabecera Cookie de una petición de prueba.
export function cookieDe(respuesta: Response): string {
  return respuesta.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0] ?? "")
    .filter((par) => par.length > 0)
    .join("; ");
}
