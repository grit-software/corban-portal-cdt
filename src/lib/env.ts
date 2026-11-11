import { z } from "zod";

// Única puerta de entrada a process.env para el código de la aplicación (src/**).
// La validación es perezosa (primera llamada a getEnv) para que `next build` no exija secretos.
// La columna "Requerida desde el paso" de §10 del blueprint decide qué es obligatorio y cuándo:
// lo que un paso posterior necesita es opcional aquí y lo exige el módulo que lo usa.

const MENSAJE_DB = "DATABASE_URL es obligatoria y debe empezar por postgres://";

const sinVacio = (valor: unknown): unknown => (valor === "" ? undefined : valor);
const opcional = () => z.preprocess(sinVacio, z.string().min(1).optional());
const conDefecto = (v: string) => z.preprocess(sinVacio, z.string().min(1).default(v));

const esquemaEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string({ error: MENSAJE_DB }).regex(/^postgres(ql)?:\/\//, MENSAJE_DB),
  BETTER_AUTH_SECRET: opcional(),
  BETTER_AUTH_URL: z.preprocess(sinVacio, z.url().default("http://localhost:3000")),
  AUTH_TEST_LOGIN: z.preprocess(sinVacio, z.enum(["0", "1"]).default("0")),
  ADMIN_EMAIL: z.preprocess(sinVacio, z.email().optional()),
  ENTRA_CLIENT_ID: opcional(),
  ENTRA_CLIENT_SECRET: opcional(),
  ENTRA_TENANT_ID: opcional(),
  STORAGE_DRIVER: z.preprocess(sinVacio, z.enum(["fs", "azure"]).default("fs")),
  STORAGE_FS_ROOT: conDefecto(".data/storage"),
  AZURE_STORAGE_ACCOUNT: opcional(),
  AZURE_STORAGE_CONTAINER: conDefecto("documentos"),
  AZURE_STORAGE_CONNECTION_STRING: opcional(),
  MAIL_DRIVER: z.preprocess(sinVacio, z.enum(["file", "smtp", "acs"]).default("file")),
  MAIL_FILE_DIR: conDefecto(".data/mail"),
  MAIL_FROM: conDefecto("Corban FC <no-responder@corbanfc.com>"),
  SMTP_HOST: conDefecto("localhost"),
  SMTP_PORT: z.preprocess(sinVacio, z.coerce.number().int().positive().default(1025)),
  ACS_CONNECTION_STRING: opcional(),
  LOG_LEVEL: z.preprocess(sinVacio, z.enum(["debug", "info", "warn", "error"]).default("info")),
});

export type Env = z.infer<typeof esquemaEnv>;

let cache: Env | undefined;

function faltantesPorDriver(env: Env): string[] {
  const faltantes: string[] = [];
  const sinCredencial = !env.AZURE_STORAGE_ACCOUNT && !env.AZURE_STORAGE_CONNECTION_STRING;
  if (env.STORAGE_DRIVER === "azure" && sinCredencial) {
    faltantes.push("AZURE_STORAGE_ACCOUNT o AZURE_STORAGE_CONNECTION_STRING");
  }
  if (env.MAIL_DRIVER === "acs" && !env.ACS_CONNECTION_STRING) {
    faltantes.push("ACS_CONNECTION_STRING");
  }
  return faltantes;
}

export function getEnv(): Env {
  if (cache) {
    return cache;
  }
  const resultado = esquemaEnv.safeParse(process.env);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    throw new Error(`Variables de entorno inválidas: ${detalle.join("; ")}`);
  }
  const faltantes = faltantesPorDriver(resultado.data);
  if (faltantes.length > 0) {
    throw new Error(`Variables de entorno faltantes: ${faltantes.join("; ")}`);
  }
  cache = resultado.data;
  return cache;
}

export function reiniciarEnvParaPruebas(): void {
  cache = undefined;
}
