// Salud básica del proceso. No importa la base de datos a propósito: el paso 1 la ejecuta
// antes de que exista Postgres. La comprobación de base de datos vive en /api/health/db (paso 2).
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ok" });
}
