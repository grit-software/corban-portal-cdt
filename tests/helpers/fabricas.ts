import { randomUUID } from "node:crypto";
import type { Actor, RolStaff } from "@/server/authz/actor";
import { getActor } from "@/server/auth/actor";
import { cookieDe, iniciarSesionPorOtp } from "@/server/auth/sesion-prueba";
import { getDb } from "@/server/db/client";
import { clientes, condicionesTasa, entidades, staffMembers } from "@/server/db/schema";

// Fábricas de datos para las pruebas. Nunca truncan tablas: cada fila lleva claves únicas
// (pruebas.md). Las pruebas que necesitan una entidad la crean con asegurarEntidades().

export function correoUnico(): string {
  return `${randomUUID()}@prueba.co`;
}

export function documentoUnico(): string {
  return randomUUID().replaceAll("-", "").slice(0, 12);
}

// Las cuatro entidades de la semilla, sin depender de que `pnpm db:seed` se haya ejecutado.
export async function asegurarEntidades(): Promise<void> {
  await getDb()
    .insert(entidades)
    .values([
      { id: "ban100", nombre: "Ban100", docKeys: ["ban_vinc", "ban_orden"] },
      { id: "colte", nombre: "Coltefinanciera", docKeys: ["colte_vinc", "colte_cdt"] },
      { id: "juris", nombre: "Juriscoop", docKeys: ["juris"], plazoEnMeses: true },
      { id: "mmujer", nombre: "Mundo Mujer", docKeys: ["mmujer"] },
    ])
    .onConflictDoNothing();
}

// Entidad propia de la prueba, para casos que necesitan un monto mínimo o una base concretos.
export async function crearEntidad(datos: {
  montoMinimo?: number;
  baseCalculo?: "calendario" | "comercial_360";
  ajusteNoHabil?: "siguiente_habil" | "anterior_habil" | "ninguno";
}): Promise<string> {
  const id = `prueba-${randomUUID()}`;
  await getDb()
    .insert(entidades)
    .values({
      id,
      nombre: `Entidad ${id}`,
      docKeys: ["prueba"],
      montoMinimo: datos.montoMinimo ?? 0,
      baseCalculo: datos.baseCalculo ?? "calendario",
      ajusteNoHabil: datos.ajusteNoHabil ?? "siguiente_habil",
    });
  return id;
}

// Staff con fila en staff_members. El actor se arma a mano; la sesión real la crea sesionStaff.
export async function crearStaff(rol: RolStaff): Promise<Actor & { tipo: "staff" }> {
  const email = correoUnico();
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: `Staff ${rol}`, rol })
    .returning({ id: staffMembers.id });
  return {
    tipo: "staff",
    userId: `usr-${randomUUID()}`,
    staffId: fila?.id ?? "",
    rol,
    email,
  };
}

// Staff con sesión real (OTP de prueba): devuelve el actor y la cookie para getActor().
export async function sesionStaff(rol: RolStaff): Promise<{ actor: Actor; cookie: string }> {
  const db = getDb();
  const email = correoUnico();
  const [fila] = await db
    .insert(staffMembers)
    .values({ email, nombre: `Staff ${rol}`, rol })
    .returning({ id: staffMembers.id });
  const cookie = cookieDe(await iniciarSesionPorOtp(email));
  const actor = await getActor(new Headers({ cookie }));
  if (actor?.tipo !== "staff" || actor.staffId !== fila?.id) {
    throw new Error("La sesión de staff de prueba no se creó bien");
  }
  return { actor, cookie };
}

// Cliente con sesión real y su registro en `clientes`.
export async function crearClienteConSesion(): Promise<{
  clienteId: string;
  cookie: string;
  email: string;
}> {
  const email = correoUnico();
  const [cliente] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Cliente de prueba",
      origen: "registro",
    })
    .returning({ id: clientes.id });
  const cookie = cookieDe(await iniciarSesionPorOtp(email));
  return { clienteId: cliente?.id ?? "", cookie, email };
}

// Condición con plazo único (pruebas.md): así no choca con otras pruebas ni con la semilla.
export async function crearCondicion(
  entidadId: string,
  datos: Partial<typeof condicionesTasa.$inferInsert> = {},
): Promise<{ id: string; plazoDias: number }> {
  const plazoDias = datos.plazoDias ?? 20_000 + Math.floor(Math.random() * 1_000_000);
  const [fila] = await getDb()
    .insert(condicionesTasa)
    .values({
      entidadId,
      plazoDias,
      montoMin: 0,
      periodicidad: "vencimiento",
      tasaEa: "10.0000",
      vigenteDesde: "2020-01-01",
      ...datos,
    })
    .returning({ id: condicionesTasa.id });
  return { id: fila?.id ?? "", plazoDias };
}
