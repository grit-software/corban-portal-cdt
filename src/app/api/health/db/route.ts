import { sql } from "drizzle-orm";
import { getDb } from "@/server/db/client";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok", db: "ok" }, { status: 200 });
  } catch {
    return Response.json({ status: "error", db: "error" }, { status: 503 });
  }
}
