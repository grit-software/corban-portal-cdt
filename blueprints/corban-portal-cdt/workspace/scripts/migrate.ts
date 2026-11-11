import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Aplica las migraciones de ./drizzle a DATABASE_URL. Idempotente: drizzle registra las
// aplicadas en drizzle.__drizzle_migrations. Se invoca con `pnpm db:migrate`
// (dotenv -e .env -- tsx scripts/migrate.ts). Nunca se ejecuta al arrancar la app.
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está definida: copia .env.example a .env o expórtala");
  }
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
    console.log("migraciones aplicadas");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
