import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit no lee .env: se carga aquí (además del `dotenv -e .env --` de los scripts).
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// schema.ts no importa nada del proyecto (solo drizzle-orm), así drizzle-kit no necesita alias.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://corban:corban@localhost:5432/corban",
  },
  verbose: true,
});
