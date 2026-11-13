import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { getEnv } from "@/lib/env";
import { enviar } from "@/server/correo/enviar";
import { plantillas } from "@/server/correo/plantillas";
import { getDb } from "@/server/db/client";
import { account, session, user, verification } from "@/server/db/schema";
import { buscarStaffActivoPorEmail } from "./staff.ts";

// Códigos OTP de la última petición, solo fuera de producción: los lee iniciarSesionPorOtp()
// en pruebas y en el test-login. Nunca se llena en producción.
export const otpParaPruebas = new Map<string, string>();

// Un usuario que entra con Microsoft debe ser staff activo (lista blanca de Entra).
export async function antesDeCrearSesion(sesion: { userId: string }): Promise<boolean> {
  const db = getDb();
  const cuentas = await db
    .select({ proveedor: account.providerId })
    .from(account)
    .where(eq(account.userId, sesion.userId));
  if (!cuentas.some((cuenta) => cuenta.proveedor === "microsoft")) {
    return true;
  }
  const [usuario] = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, sesion.userId))
    .limit(1);
  if (!usuario) {
    return false;
  }
  return (await buscarStaffActivoPorEmail(usuario.email)) !== undefined;
}

function construirAuth() {
  const env = getEnv();
  const secreto = env.BETTER_AUTH_SECRET ?? "";
  if (secreto.length < 32) {
    throw new Error("BETTER_AUTH_SECRET debe tener al menos 32 caracteres");
  }
  const entra =
    env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET && env.ENTRA_TENANT_ID
      ? {
          clientId: env.ENTRA_CLIENT_ID,
          clientSecret: env.ENTRA_CLIENT_SECRET,
          tenantId: env.ENTRA_TENANT_ID,
          prompt: "select_account" as const,
        }
      : undefined;

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification },
    }),
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL],
    secret: secreto,
    rateLimit: { enabled: false },
    session: { expiresIn: 604800, updateAge: 86400 },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        disableSignUp: false,
        sendVerificationOTP: async ({ email, otp }) => {
          const correo = email.trim().toLowerCase();
          if (getEnv().NODE_ENV !== "production") {
            otpParaPruebas.set(correo, otp);
          }
          await enviar({
            para: correo,
            ...plantillas.otp({ codigo: otp }),
          });
        },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (sesion) => antesDeCrearSesion(sesion),
        },
      },
    },
    socialProviders: entra ? { microsoft: entra } : {},
  });
}

let instancia: ReturnType<typeof construirAuth> | undefined;

// Memoizado y perezoso: nada toca la base ni exige secretos al importar el módulo.
export function getAuth(): ReturnType<typeof construirAuth> {
  if (!instancia) {
    instancia = construirAuth();
  }
  return instancia;
}

export function reiniciarAuthParaPruebas(): void {
  instancia = undefined;
}
