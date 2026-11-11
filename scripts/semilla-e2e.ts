import postgres from "postgres";

// Staff fijo para las pruebas E2E (lo invoca tests/e2e/preparar.ts contra corban_test).
// Columnas de staff_members según src/server/db/schema.ts (§4 del blueprint).
const STAFF_E2E = [
  { email: "asesor.e2e@corbanfc.com", nombre: "Asesora E2E", rol: "asesor" },
  { email: "asesor2.e2e@corbanfc.com", nombre: "Asesor Dos E2E", rol: "asesor" },
  { email: "coordinador.e2e@corbanfc.com", nombre: "Coordinadora E2E", rol: "coordinador" },
  { email: "gerencia.e2e@corbanfc.com", nombre: "Gerencia E2E", rol: "gerencia" },
  { email: "admin.e2e@corbanfc.com", nombre: "Admin E2E", rol: "admin" },
];

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL no está definida");
  }
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  try {
    for (const miembro of STAFF_E2E) {
      await sql`
        insert into staff_members (email, nombre, rol, activo)
        values (${miembro.email}, ${miembro.nombre}, ${miembro.rol}, true)
        on conflict do nothing
      `;
    }
    console.log(`staff E2E listo (${STAFF_E2E.length} miembros)`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
