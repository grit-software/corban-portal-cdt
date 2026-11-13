import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { GET as solicitudGet } from "@/app/api/v1/solicitudes/[id]/route";
import { VERSION_CONSENTIMIENTO, getActor } from "@/server/auth/actor";
import { cerrarDb, getDb } from "@/server/db/client";
import { clientes, consentimientos, solicitudes } from "@/server/db/schema";
import { obtenerSolicitud } from "@/server/solicitudes/servicio";
import { crearEntidad, crearStaff } from "../helpers/fabricas.ts";
import {
  BASE,
  correoUnico,
  documentoUnico,
  ingresarCliente,
  ipUnica,
} from "../helpers/auth-clientes.ts";
import { ErrorDominio } from "@/server/authz/errores";

// Aislamiento entre clientes y entre asesores (CLAUDE.md, regla 1): lo ajeno es NO_ENCONTRADO.

afterAll(cerrarDb);

async function clienteConConsentimiento(): Promise<{ cookie: string; clienteId: string }> {
  const email = correoUnico();
  const [cliente] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Aislado",
      origen: "registro",
    })
    .returning({ id: clientes.id });
  const cookie = await ingresarCliente(email);
  const actor = await getActor(new Headers({ cookie }));
  if (actor?.tipo !== "cliente") {
    throw new Error("El cliente de prueba no quedó enlazado");
  }
  await getDb()
    .insert(consentimientos)
    .values({
      userId: actor.userId,
      clienteId: cliente?.id ?? null,
      version: VERSION_CONSENTIMIENTO,
      ip: ipUnica(),
      userAgent: "prueba",
    });
  return { cookie, clienteId: cliente?.id ?? "" };
}

async function solicitudDe(
  clienteId: string,
  entidadId: string,
  asesorId: string | null = null,
): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(solicitudes)
    .values({ id, clienteId, entidadId, asesorId, estado: "borrador", datos: {} });
  return id;
}

describe("aislamiento de solicitudes", () => {
  it("el cliente A no ve la solicitud del cliente B: NO_ENCONTRADO por la API", async () => {
    const entidadId = await crearEntidad({});
    const a = await clienteConConsentimiento();
    const b = await clienteConConsentimiento();
    const solicitudB = await solicitudDe(b.clienteId, entidadId);

    const respuesta = await solicitudGet(
      new Request(`${BASE}/api/v1/solicitudes/${solicitudB}`, { headers: { cookie: a.cookie } }),
      { params: Promise.resolve({ id: solicitudB }) },
    );
    expect(respuesta.status).toBe(404);
    expect((await respuesta.json()).error.code).toBe("NO_ENCONTRADO");
  });

  it("un asesor no asignado recibe NO_ENCONTRADO del servicio; el asignado sí ve la solicitud", async () => {
    const entidadId = await crearEntidad({});
    const cliente = await clienteConConsentimiento();
    const asignado = await crearStaff("asesor");
    const otro = await crearStaff("asesor");
    const solicitud = await solicitudDe(cliente.clienteId, entidadId, asignado.staffId);

    await expect(obtenerSolicitud(otro, solicitud)).rejects.toMatchObject({
      code: "NO_ENCONTRADO",
    });
    const visto = await obtenerSolicitud(asignado, solicitud);
    expect(visto.solicitud.id).toBe(solicitud);
  });

  it("un cliente sin ser dueño tampoco obtiene el detalle por el servicio", async () => {
    const entidadId = await crearEntidad({});
    const duenio = await clienteConConsentimiento();
    const intruso = await clienteConConsentimiento();
    const solicitud = await solicitudDe(duenio.clienteId, entidadId);
    const actorIntruso = await getActor(new Headers({ cookie: intruso.cookie }));
    if (actorIntruso?.tipo !== "cliente") throw new Error("sin actor de cliente");

    const error = await obtenerSolicitud(actorIntruso, solicitud).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorDominio);
    expect((error as ErrorDominio).code).toBe("NO_ENCONTRADO");
  });
});
