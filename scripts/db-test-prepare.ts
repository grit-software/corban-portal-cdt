import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Recrea desde cero la base de pruebas (TEST_DATABASE_URL) y le aplica todas las migraciones.
// Idempotente: cada ejecución deja el mismo estado. Solo acepta bases cuyo nombre termina en
// _test, para que un error de configuración nunca borre la base de desarrollo.
async function main(): Promise<void> {
  const urlPruebas = process.env.TEST_DATABASE_URL;
  if (!urlPruebas) {
    throw new Error("TEST_DATABASE_URL no está definida (ver .env.example)");
  }
  const nombre = new URL(urlPruebas).pathname.replace(/^\//, "");
  if (!/^[a-z0-9_]+_test$/.test(nombre)) {
    throw new Error(`Solo se recrean bases que terminan en _test (recibido: ${nombre})`);
  }
  const urlAdmin = new URL(urlPruebas);
  urlAdmin.pathname = "/postgres";
  const sqlAdmin = postgres(urlAdmin.toString(), { max: 1, onnotice: () => undefined });
  try {
    await sqlAdmin.unsafe(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
    await sqlAdmin.unsafe(`CREATE DATABASE "${nombre}"`);
  } finally {
    await sqlAdmin.end();
  }
  const sql = postgres(urlPruebas, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
  } finally {
    await sql.end();
  }
  console.log(`base ${nombre} recreada y migrada`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
