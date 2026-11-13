import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { PATCH as perfilPatch, GET as perfilGet } from "@/app/api/v1/perfil/route";
import { GET as opcionesGet } from "@/app/api/v1/condiciones/opciones/route";
import { GET as solicitudesGet, POST as solicitudesPost } from "@/app/api/v1/solicitudes/route";
import { PATCH as solicitudPatch } from "@/app/api/v1/solicitudes/[id]/route";
import { POST as enviarPost } from "@/app/api/v1/solicitudes/[id]/enviar/route";
import { VERSION_CONSENTIMIENTO, getActor } from "@/server/auth/actor";
import { cerrarDb, getDb } from "@/server/db/client";
import {
  auditEvents,
  clientes,
  consentimientos,
  solicitudes,
  solicitudEventos,
} from "@/server/db/schema";
import { crearCondicion, crearEntidad } from "../helpers/fabricas.ts";
import {
  BASE,
  correoUnico,
  documentoUnico,
  ingresarCliente,
  ipUnica,
  peticion,
} from "../helpers/auth-clientes.ts";

// Pruebas de la API v1 del cliente (E2-T2). Cada ruta se llama como handler con un Request real.

afterAll(cerrarDb);

// Mismo origen que BETTER_AUTH_URL: exigirMismoOrigen lo compara en cada mutación.
function peticionCon(
  metodo: "PATCH" | "GET",
  ruta: string,
  cuerpo: unknown,
  cookie: string,
): Request {
  return new Request(`${BASE}${ruta}`, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      origin: new URL(BASE).origin,
      cookie,
    },
    body: metodo === "GET" ? undefined : JSON.stringify(cuerpo),
  });
}

// Cliente con registro, perfil opcional y consentimiento vigente.
async function clienteListo(perfil: Record<string, string> = {}) {
  const email = correoUnico();
  await getDb().insert(clientes).values({
    tipoDoc: "CC",
    numDoc: documentoUnico(),
    email,
    nombre: "Cliente",
    origen: "registro",
    perfil,
  });
  const cookie = await ingresarCliente(email);
  const actor = await getActor(new Headers({ cookie }));
  if (actor?.tipo !== "cliente" || !actor.clienteId) {
    throw new Error("El cliente de prueba no quedó enlazado");
  }
  await getDb().insert(consentimientos).values({
    userId: actor.userId,
    clienteId: actor.clienteId,
    version: VERSION_CONSENTIMIENTO,
    ip: ipUnica(),
    userAgent: "prueba",
  });
  return { cookie, clienteId: actor.clienteId, userId: actor.userId };
}

async function crearSolicitud(
  cookie: string,
  entidadId: string,
): Promise<{ id: string; codigo: string; estado: string; datos: Record<string, string> }> {
  const respuesta = await solicitudesPost(
    peticion("/api/v1/solicitudes", { entidadId }, { cookie }),
  );
  return (await respuesta.json()).data;
}

const DATOS_CDT = {
  valor: "5000000",
  plazo_dias: "0",
  fecha_apertura: "2026-03-02",
  tipo_cdt: "desmaterializado",
  forma_pago: "transferencia",
  ciudad: "Medellín",
};
const DATOS_PERSONAL = {
  nombre1: "Ana",
  apellido1: "Gómez",
  tipo_doc: "CC",
  num_doc: "12345678",
  celular: "3001234567",
  direccion: "Calle 10 # 40-25",
  ciudad_res: "Medellín",
};
const DATOS_PAGO = {
  periodicidad: "vencimiento",
  cta_banco: "Bancolombia",
  cta_tipo: "ahorros",
  cta_numero: "12345678901",
  cta_titular: "Ana Gómez",
};

describe("API v1: solicitudes del cliente", () => {
  it("criterio 1: crea un borrador en estado borrador con datos precargados del perfil", async () => {
    const entidadId = await crearEntidad({ ajusteNoHabil: "ninguno" });
    const cliente = await clienteListo({ nombre1: "Ana", apellido1: "Gómez" });

    const respuesta = await solicitudesPost(
      peticion("/api/v1/solicitudes", { entidadId }, { cookie: cliente.cookie }),
    );
    expect(respuesta.status).toBe(201);
    const { data } = await respuesta.json();
    expect(data.estado).toBe("borrador");
    expect(data.codigo).toMatch(/^SOL-\d{6}$/);
    expect(data.datos.nombre1).toBe("Ana");
    expect(data.datos.apellido1).toBe("Gómez");
  });

  it("criterio 2: PATCH fusiona solo las claves del paso; claves ajenas y estado no editable responden 422 / 409", async () => {
    const entidadId = await crearEntidad({});
    const cliente = await clienteListo();
    const borrador = await crearSolicitud(cliente.cookie, entidadId);

    const ok = await solicitudPatch(
      peticionCon(
        "PATCH",
        `/api/v1/solicitudes/${borrador.id}`,
        { paso: "personal", datos: { nombre2: "Fernanda" } },
        cliente.cookie,
      ),
      { params: Promise.resolve({ id: borrador.id }) },
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.datos.nombre2).toBe("Fernanda");

    const ajena = await solicitudPatch(
      peticionCon(
        "PATCH",
        `/api/v1/solicitudes/${borrador.id}`,
        { paso: "cdt", datos: { nombre1: "x" } },
        cliente.cookie,
      ),
      { params: Promise.resolve({ id: borrador.id }) },
    );
    expect(ajena.status).toBe(422);
    expect((await ajena.json()).error.code).toBe("VALIDACION");

    await getDb()
      .update(solicitudes)
      .set({ estado: "pendiente_validacion" })
      .where(eq(solicitudes.id, borrador.id));
    const bloqueada = await solicitudPatch(
      peticionCon(
        "PATCH",
        `/api/v1/solicitudes/${borrador.id}`,
        { paso: "personal", datos: { nombre2: "Otro" } },
        cliente.cookie,
      ),
      { params: Promise.resolve({ id: borrador.id }) },
    );
    expect(bloqueada.status).toBe(409);
    expect((await bloqueada.json()).error.code).toBe("TRANSICION_INVALIDA");
  });

  it("criterio 3: enviar con obligatorias vacías responde 422 VALIDACION con fields y no cambia el estado", async () => {
    const entidadId = await crearEntidad({});
    const cliente = await clienteListo();
    const borrador = await crearSolicitud(cliente.cookie, entidadId);

    const respuesta = await enviarPost(
      peticion(`/api/v1/solicitudes/${borrador.id}/enviar`, {}, { cookie: cliente.cookie }),
      { params: Promise.resolve({ id: borrador.id }) },
    );
    expect(respuesta.status).toBe(422);
    const { error } = await respuesta.json();
    expect(error.code).toBe("VALIDACION");
    expect(Object.keys(error.fields)).toEqual(
      expect.arrayContaining(["valor", "nombre1", "cta_numero"]),
    );

    const [fila] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, borrador.id));
    expect(fila?.estado).toBe("borrador");
  });

  it("criterio 4: sin condición aplicable responde SIN_CONDICION (422); con condición pasa a pendiente_validacion con evento y auditoría", async () => {
    const entidadId = await crearEntidad({ ajusteNoHabil: "ninguno" });
    const plazo = 30_000 + Math.floor(Math.random() * 500_000);
    const cliente = await clienteListo();
    const borrador = await crearSolicitud(cliente.cookie, entidadId);
    for (const [paso, datos] of [
      ["cdt", { ...DATOS_CDT, plazo_dias: String(plazo) }],
      ["personal", DATOS_PERSONAL],
      ["pago", DATOS_PAGO],
    ] as const) {
      const r = await solicitudPatch(
        peticionCon("PATCH", `/api/v1/solicitudes/${borrador.id}`, { paso, datos }, cliente.cookie),
        { params: Promise.resolve({ id: borrador.id }) },
      );
      expect(r.status).toBe(200);
    }

    const sinCondicion = await enviarPost(
      peticion(`/api/v1/solicitudes/${borrador.id}/enviar`, {}, { cookie: cliente.cookie }),
      { params: Promise.resolve({ id: borrador.id }) },
    );
    expect(sinCondicion.status).toBe(422);
    expect((await sinCondicion.json()).error.code).toBe("SIN_CONDICION");

    await crearCondicion(entidadId, {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "10.5000",
      vigenteDesde: "2020-01-01",
    });
    const enviada = await enviarPost(
      peticion(`/api/v1/solicitudes/${borrador.id}/enviar`, {}, { cookie: cliente.cookie }),
      { params: Promise.resolve({ id: borrador.id }) },
    );
    expect(enviada.status).toBe(200);
    expect((await enviada.json()).data.estado).toBe("pendiente_validacion");

    const eventos = await getDb()
      .select()
      .from(solicitudEventos)
      .where(
        and(
          eq(solicitudEventos.solicitudId, borrador.id),
          eq(solicitudEventos.hacia, "pendiente_validacion"),
        ),
      );
    expect(eventos).toHaveLength(1);
    const auditoria = await getDb()
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.accion, "solicitud.enviar"), eq(auditEvents.targetId, borrador.id)),
      );
    expect(auditoria).toHaveLength(1);

    const [perfil] = await getDb()
      .select({ perfil: clientes.perfil })
      .from(clientes)
      .where(eq(clientes.id, cliente.clienteId));
    expect(perfil?.perfil.nombre1).toBe("Ana");
  });

  it("criterio 6: sin consentimiento, cualquier ruta de solicitudes responde 403 CONSENTIMIENTO_REQUERIDO", async () => {
    const email = correoUnico();
    await getDb().insert(clientes).values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Sin consentimiento",
      origen: "registro",
    });
    const cookie = await ingresarCliente(email);

    const respuesta = await solicitudesGet(
      new Request(`${BASE}/api/v1/solicitudes`, { headers: { cookie } }),
    );
    expect(respuesta.status).toBe(403);
    expect((await respuesta.json()).error.code).toBe("CONSENTIMIENTO_REQUERIDO");
  });

  it("condiciones/opciones y perfil responden para un cliente con consentimiento", async () => {
    const entidadId = await crearEntidad({});
    const plazo = 40_000 + Math.floor(Math.random() * 500_000);
    await crearCondicion(entidadId, {
      plazoDias: plazo,
      periodicidad: "vencimiento",
      tasaEa: "9.9000",
      vigenteDesde: "2020-01-01",
    });
    const cliente = await clienteListo();

    const opciones = await opcionesGet(
      new Request(`${BASE}/api/v1/condiciones/opciones?entidadId=${entidadId}&valor=5000000`, {
        headers: { cookie: cliente.cookie },
      }),
    );
    expect(opciones.status).toBe(200);
    expect((await opciones.json()).data).toEqual([
      { plazoDias: plazo, periodicidad: "vencimiento", tasaEa: "9.9000" },
    ]);

    const actualizado = await perfilPatch(
      peticionCon("PATCH", "/api/v1/perfil", { nombre1: "Lucía" }, cliente.cookie),
    );
    expect(actualizado.status).toBe(200);
    const perfil = await perfilGet(
      new Request(`${BASE}/api/v1/perfil`, { headers: { cookie: cliente.cookie } }),
    );
    expect((await perfil.json()).data.nombre1).toBe("Lucía");
  });
});
