import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import type { Actor } from "@/server/authz/actor";
import {
  auditEvents,
  clientes,
  solicitudEventos,
  solicitudes,
  staffMembers,
  user,
} from "@/server/db/schema";
import { cerrarDb, getDb } from "@/server/db/client";
import { cambiarRolStaff, crearStaff, desactivarStaff } from "@/server/auth/staff";
import type { Mensaje } from "@/server/correo/enviar";
import { notificar } from "@/server/solicitudes/notificaciones";
import {
  crearEntidad,
  crearStaff as crearStaffActor,
  correoUnico,
  documentoUnico,
} from "../helpers/fabricas.ts";

// Notificaciones de transición y administración del staff (E3-T4). Cada prueba crea sus filas con
// claves únicas. El envío se inyecta: no se escriben correos reales.

afterAll(cerrarDb);

async function crearAdmin(): Promise<Actor & { tipo: "staff" }> {
  const email = correoUnico();
  const userId = randomUUID();
  await getDb().insert(user).values({ id: userId, name: "Admin de prueba", email });
  const [fila] = await getDb()
    .insert(staffMembers)
    .values({ email, nombre: "Admin de prueba", rol: "admin", userId })
    .returning({ id: staffMembers.id });
  return { tipo: "staff", userId, staffId: fila?.id ?? "", rol: "admin", email };
}

async function clienteCon(email: string): Promise<string> {
  const [fila] = await getDb()
    .insert(clientes)
    .values({
      tipoDoc: "CC",
      numDoc: documentoUnico(),
      email,
      nombre: "Cliente de correo",
      origen: "registro",
    })
    .returning({ id: clientes.id });
  return fila?.id ?? "";
}

// Solicitud con su evento de transición ya registrado (como lo deja ejecutarTransicion).
async function solicitudEnTransicion(opciones: {
  clienteId: string;
  asesorId: string | null;
  entidadId: string;
  hacia: string;
}): Promise<string> {
  const id = randomUUID();
  await getDb()
    .insert(solicitudes)
    .values({
      id,
      clienteId: opciones.clienteId,
      asesorId: opciones.asesorId,
      entidadId: opciones.entidadId,
      estado: opciones.hacia as "pendiente_validacion",
      valor: 1_000_000,
      tasaEa: "10.2500",
      periodicidad: "mensual",
      fechaApertura: "2099-01-02",
      fechaVenc: "2099-07-02",
      datos: {},
    });
  await getDb().insert(solicitudEventos).values({
    solicitudId: id,
    tipo: "transicion",
    desde: "borrador",
    hacia: opciones.hacia,
  });
  return id;
}

async function notificadoAt(solicitudId: string, hacia: string) {
  const [fila] = await getDb()
    .select({ notificadoAt: solicitudEventos.notificadoAt })
    .from(solicitudEventos)
    .where(and(eq(solicitudEventos.solicitudId, solicitudId), eq(solicitudEventos.hacia, hacia)));
  return fila?.notificadoAt ?? null;
}

describe("notificaciones de transición (E3-T4)", () => {
  it("pendiente_validacion avisa al asesor asignado con el código y el enlace al detalle", async () => {
    const asesor = await crearStaffActor("asesor");
    const entidadId = await crearEntidad({});
    const clienteId = await clienteCon(correoUnico());
    const solicitudId = await solicitudEnTransicion({
      clienteId,
      asesorId: asesor.staffId,
      entidadId,
      hacia: "pendiente_validacion",
    });
    const enviados: Mensaje[] = [];

    const resultado = await notificar(
      { solicitudId, accion: "enviar", hacia: "pendiente_validacion" },
      async (m) => {
        enviados.push(m);
      },
    );

    expect(resultado.notificado).toBe(true);
    expect(enviados.map((m) => m.para)).toEqual([asesor.email]);
    expect(enviados[0]?.asunto).toMatch(/SOL-\d{6}/);
    expect(enviados[0]?.html).toContain(`/asesor/solicitudes/${solicitudId}`);
    expect(await notificadoAt(solicitudId, "pendiente_validacion")).not.toBeNull();
  });

  it("devuelta avisa al cliente con el enlace a su solicitud", async () => {
    const entidadId = await crearEntidad({});
    const correo = correoUnico();
    const clienteId = await clienteCon(correo);
    const solicitudId = await solicitudEnTransicion({
      clienteId,
      asesorId: null,
      entidadId,
      hacia: "devuelta",
    });
    const enviados: Mensaje[] = [];

    await notificar({ solicitudId, accion: "devolver", hacia: "devuelta" }, async (m) => {
      enviados.push(m);
    });

    expect(enviados.map((m) => m.para)).toEqual([correo]);
    expect(enviados[0]?.html).toContain(`/mi-cuenta/solicitudes/${solicitudId}`);
  });

  it("sin asesor asignado, pendiente_validacion avisa a los coordinadores activos", async () => {
    const coordinador = await crearStaffActor("coordinador");
    const entidadId = await crearEntidad({});
    const clienteId = await clienteCon(correoUnico());
    const solicitudId = await solicitudEnTransicion({
      clienteId,
      asesorId: null,
      entidadId,
      hacia: "pendiente_validacion",
    });
    const enviados: Mensaje[] = [];

    await notificar({ solicitudId, accion: "enviar", hacia: "pendiente_validacion" }, async (m) => {
      enviados.push(m);
    });

    expect(enviados.map((m) => m.para)).toContain(coordinador.email);
  });

  it("si el envío falla, la transición se conserva, no se lanza y notificado_at queda nulo", async () => {
    const asesor = await crearStaffActor("asesor");
    const entidadId = await crearEntidad({});
    const clienteId = await clienteCon(correoUnico());
    const solicitudId = await solicitudEnTransicion({
      clienteId,
      asesorId: asesor.staffId,
      entidadId,
      hacia: "firma_en_revision",
    });

    const resultado = await notificar(
      { solicitudId, accion: "cargar_firma", hacia: "firma_en_revision" },
      async () => {
        throw new Error("SMTP caído");
      },
    );

    expect(resultado.notificado).toBe(false);
    expect(await notificadoAt(solicitudId, "firma_en_revision")).toBeNull();
    const [solicitud] = await getDb()
      .select({ estado: solicitudes.estado })
      .from(solicitudes)
      .where(eq(solicitudes.id, solicitudId));
    expect(solicitud?.estado).toBe("firma_en_revision");
  });

  it("manifest() devuelve el nombre, el inicio, la visualización y los íconos de la PWA", () => {
    const datos = manifest();
    expect(datos).toMatchObject({
      name: "Corban CDT",
      short_name: "Corban CDT",
      start_url: "/mi-cuenta",
      display: "standalone",
      background_color: "#F5F6F7",
      theme_color: "#1D2226",
      lang: "es-CO",
    });
    expect(datos.icons?.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
  });
});

describe("administración del staff (E3-T4)", () => {
  it("un admin crea, cambia de rol y desactiva un miembro, cada cambio con auditoría", async () => {
    const admin = await crearAdmin();
    const email = correoUnico();

    const { id } = await crearStaff(admin, { email, nombre: "Miembro nuevo", rol: "asesor" });
    await cambiarRolStaff(admin, { id, rol: "coordinador", motivo: "Ascenso" });
    await desactivarStaff(admin, { id, motivo: "Salió de la empresa" });

    const [miembro] = await getDb().select().from(staffMembers).where(eq(staffMembers.id, id));
    expect(miembro).toMatchObject({ rol: "coordinador", activo: false });
    const eventos = await getDb()
      .select({ accion: auditEvents.accion })
      .from(auditEvents)
      .where(eq(auditEvents.targetId, id));
    expect(eventos.map((e) => e.accion)).toEqual(
      expect.arrayContaining(["staff.crear", "staff.cambiar_rol", "staff.desactivar"]),
    );
  });

  it("un coordinador recibe PROHIBIDO al intentar administrar el staff", async () => {
    const coordinador = await crearStaffActor("coordinador");
    await expect(
      crearStaff(coordinador, { email: correoUnico(), nombre: "No debe crearse", rol: "asesor" }),
    ).rejects.toMatchObject({ code: "PROHIBIDO" });
  });
});
