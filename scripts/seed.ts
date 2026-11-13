import { getEnv } from "@/lib/env";
import { cerrarDb, getDb } from "@/server/db/client";
import { sembrarBase } from "@/server/db/seed-base";

// Uso: `pnpm db:seed` o, con tasas DEMO, `pnpm db:seed:demo`.
async function main(): Promise<void> {
  const adminEmail = getEnv().ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL no está definida (ver .env.example)");
  }
  const demo = process.argv.includes("--demo");
  try {
    await sembrarBase(getDb(), { adminEmail, demo });
    console.log(`semilla aplicada${demo ? " (con tasas DEMO)" : ""}`);
  } finally {
    await cerrarDb();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
