import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { POST as loginDePrueba } from "@/app/api/test/login/route";
import { reiniciarEnvParaPruebas } from "@/lib/env";
import type { Actor, RolStaff } from "@/server/authz/actor";
import { getActor } from "@/server/auth/actor";
import { antesDeCrearSesion, getAuth, reiniciarAuthParaPruebas } from "@/server/auth/auth";
import { cookieDe, iniciarSesionPorOtp } from "@/server/auth/sesion-prueba";
import { desactivarStaff } from "@/server/auth/staff";
import { cerrarDb, getDb } from "@/server/db/client";
import { account, staffMembers, user } from "@/server/db/schema";

function correoUnico(): string {
  return `${randomUUID()}@prueba.co`;
}

// Staff de prueba insertado directamente (crearStaff exige un administrador; se prueba aparte).
async function staffDePrueba(rol: RolStaff): Promise<{ id: string; email: string }> {
  const email = correoUnico();
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Staff de prueba", rol })
    .returning({ id: staffMembers.id });
  return { id: fila?.id ?? "", email };
}

const ADMIN: Actor = {
  tipo: "staff",
  userId: "usr-admin-prueba",
  staffId: randomUUID(),
  rol: "admin",
  email: "admin.prueba@prueba.co",
};

function cabeceraCon(cookie: string): Headers {
  return new Headers({ cookie });
}

describe("autenticación del staff", () => {
  afterAll(cerrarDb);

  it("iniciarSesionPorOtp crea sesión y getActor devuelve el staff con el rol de su fila", async () => {
    const staff = await staffDePrueba("coordinador");
    const respuesta = await iniciarSesionPorOtp(staff.email);
    expect(respuesta.status).toBe(200);
    const cookie = cookieDe(respuesta);
    expect(cookie.length).toBeGreaterThan(0);

    const actor = await getActor(cabeceraCon(cookie));
    expect(actor?.tipo).toBe("staff");
    if (actor?.tipo === "staff") {
      expect(actor.rol).toBe("coordinador");
      expect(actor.staffId).toBe(staff.id);
    }
  });

  it("antesDeCrearSesion rechaza una cuenta de Microsoft cuyo correo no es staff activo", async () => {
    const usuarioId = randomUUID();
    const correo = correoUnico();
    const db = getDb();
    await db.insert(user).values({ id: usuarioId, name: "Externo", email: correo });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: randomUUID(),
      providerId: "microsoft",
      userId: usuarioId,
    });

    await expect(antesDeCrearSesion({ userId: usuarioId })).resolves.toBe(false);

    // El mismo usuario, si su correo está en la lista blanca de staff, sí puede entrar.
    await db
      .insert(staffMembers)
      .values({ email: correo, nombre: "Staff Microsoft", rol: "asesor" });
    await expect(antesDeCrearSesion({ userId: usuarioId })).resolves.toBe(true);
  });

  it("desactivarStaff borra las sesiones: la cookie anterior deja de dar actor", async () => {
    const staff = await staffDePrueba("asesor");
    const cookie = cookieDe(await iniciarSesionPorOtp(staff.email));
    expect(await getActor(cabeceraCon(cookie))).not.toBeNull();

    await desactivarStaff(ADMIN, { id: staff.id, motivo: "Prueba de desactivación" });

    expect(await getActor(cabeceraCon(cookie))).toBeNull();
  });

  it("POST /api/test/login responde 200 con cookie para staff activo y 404 para otro correo", async () => {
    const staff = await staffDePrueba("gerencia");
    const enStaff = await loginDePrueba(
      new Request("http://localhost/api/test/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: staff.email }),
      }),
    );
    expect(enStaff.status).toBe(200);
    expect(enStaff.headers.getSetCookie().length).toBeGreaterThan(0);

    const noStaff = await loginDePrueba(
      new Request("http://localhost/api/test/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: correoUnico() }),
      }),
    );
    expect(noStaff.status).toBe(404);
  });

  it("POST /api/test/login responde 404 en producción", async () => {
    const original = process.env.NODE_ENV;
    const staff = await staffDePrueba("asesor");
    Reflect.set(process.env, "NODE_ENV", "production");
    reiniciarEnvParaPruebas();
    try {
      const respuesta = await loginDePrueba(
        new Request("http://localhost/api/test/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: staff.email }),
        }),
      );
      expect(respuesta.status).toBe(404);
    } finally {
      Reflect.set(process.env, "NODE_ENV", original);
      reiniciarEnvParaPruebas();
    }
  });

  it("getAuth lanza nombrando BETTER_AUTH_SECRET si falta o es corto", () => {
    const original = process.env.BETTER_AUTH_SECRET;
    try {
      Reflect.deleteProperty(process.env, "BETTER_AUTH_SECRET");
      reiniciarEnvParaPruebas();
      reiniciarAuthParaPruebas();
      expect(() => getAuth()).toThrow(/BETTER_AUTH_SECRET/);

      process.env.BETTER_AUTH_SECRET = "corto";
      reiniciarEnvParaPruebas();
      reiniciarAuthParaPruebas();
      expect(() => getAuth()).toThrow(/BETTER_AUTH_SECRET/);
    } finally {
      if (original !== undefined) {
        process.env.BETTER_AUTH_SECRET = original;
      }
      reiniciarEnvParaPruebas();
      reiniciarAuthParaPruebas();
    }
  });

  it("arranca sin el proveedor microsoft si faltan las variables ENTRA_*", () => {
    const guardadas = {
      ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID,
      ENTRA_CLIENT_SECRET: process.env.ENTRA_CLIENT_SECRET,
      ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID,
    };
    try {
      Reflect.deleteProperty(process.env, "ENTRA_CLIENT_ID");
      Reflect.deleteProperty(process.env, "ENTRA_CLIENT_SECRET");
      Reflect.deleteProperty(process.env, "ENTRA_TENANT_ID");
      reiniciarEnvParaPruebas();
      reiniciarAuthParaPruebas();
      expect(() => getAuth()).not.toThrow();
    } finally {
      for (const [clave, valor] of Object.entries(guardadas)) {
        if (valor !== undefined) {
          process.env[clave] = valor;
        }
      }
      reiniciarEnvParaPruebas();
      reiniciarAuthParaPruebas();
    }
  });
});
