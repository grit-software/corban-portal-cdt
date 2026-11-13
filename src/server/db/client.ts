import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema>;

let conexion: { db: Db; sql: ReturnType<typeof postgres> } | undefined;

export function getDb(): Db {
  if (!conexion) {
    const sql = postgres(getEnv().DATABASE_URL, { max: 10, onnotice: () => undefined });
    conexion = { sql, db: drizzle(sql, { schema }) };
  }
  return conexion.db;
}

export async function cerrarDb(): Promise<void> {
  if (conexion) {
    await conexion.sql.end();
    conexion = undefined;
  }
}
