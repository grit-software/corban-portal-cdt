// Contenido COMPLETO de src/server/db/schema.ts a partir del paso 3 (idéntico a §4 del blueprint).
// El paso 2 escribe solo la tabla `festivos` (mismo bloque que aquí); el paso 3 reemplaza el
// archivo por este texto y ejecuta `pnpm db:generate`.
// Regla: este archivo no importa nada del proyecto (drizzle-kit lo carga sin alias).
import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const ROLES_STAFF = ["asesor", "coordinador", "gerencia", "admin"] as const;

export const ESTADOS_SOLICITUD = [
  "borrador",
  "pendiente_validacion",
  "devuelta",
  "pendiente_firma",
  "firma_en_revision",
  "lista_para_enviar",
  "enviada_entidad",
  "cdt_constituido",
  "cancelada",
] as const;

export const PERIODICIDADES = [
  "vencimiento",
  "mensual",
  "bimestral",
  "trimestral",
  "semestral",
  "anual",
] as const;

const creadoEn = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const actualizadoEn = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const fecha = (nombre: string) => date(nombre, { mode: "string" });
const pesos = (nombre: string) => bigint(nombre, { mode: "number" });
const tasa = (nombre: string) => numeric(nombre, { precision: 6, scale: 4 });

// ---------------------------------------------------------------------------------------------
// Tablas de better-auth 1.7 (escritas a mano; las claves de propiedad son las que espera el
// adaptador drizzle: id, name, email, emailVerified, ... ; las columnas van en snake_case).
// ---------------------------------------------------------------------------------------------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: creadoEn(),
  updatedAt: actualizadoEn(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------------------------
// Staff y clientes
// ---------------------------------------------------------------------------------------------
export const staffMembers = pgTable(
  "staff_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    rol: text("rol", { enum: ROLES_STAFF }).notNull(),
    activo: boolean("activo").notNull().default(true),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("staff_members_email_uq").on(sql`lower(${t.email})`),
    check("staff_members_rol_ck", sql`${t.rol} in ('asesor', 'coordinador', 'gerencia', 'admin')`),
  ],
);

export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .unique()
      .references(() => user.id, { onDelete: "set null" }),
    tipoDoc: text("tipo_doc").notNull(),
    numDoc: text("num_doc").notNull(),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    celular: text("celular"),
    asesorId: uuid("asesor_id").references(() => staffMembers.id, { onDelete: "set null" }),
    origen: text("origen").notNull().default("registro"),
    perfil: jsonb("perfil").$type<Record<string, string>>().notNull().default({}),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("clientes_documento_uq").on(t.tipoDoc, t.numDoc),
    index("clientes_asesor_idx").on(t.asesorId),
    index("clientes_email_idx").on(sql`lower(${t.email})`),
    check("clientes_tipo_doc_ck", sql`${t.tipoDoc} in ('CC', 'CE', 'TI', 'PAS', 'NUIP')`),
    check("clientes_origen_ck", sql`${t.origen} in ('registro', 'invitacion', 'importacion')`),
  ],
);

export const invitaciones = pgTable(
  "invitaciones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "cascade" }),
    asesorId: uuid("asesor_id")
      .notNull()
      .references(() => staffMembers.id),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: creadoEn(),
  },
  (t) => [index("invitaciones_cliente_idx").on(t.clienteId)],
);

export const consentimientos = pgTable(
  "consentimientos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    clienteId: uuid("cliente_id").references(() => clientes.id),
    version: text("version").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [uniqueIndex("consentimientos_usuario_version_uq").on(t.userId, t.version)],
);

// ---------------------------------------------------------------------------------------------
// Entidades, condiciones de tasa y festivos
// ---------------------------------------------------------------------------------------------
export const entidades = pgTable(
  "entidades",
  {
    id: text("id").primaryKey(),
    nombre: text("nombre").notNull(),
    docKeys: text("doc_keys").array().notNull(),
    montoMinimo: pesos("monto_minimo").notNull().default(0),
    baseCalculo: text("base_calculo").notNull().default("calendario"),
    ajusteNoHabil: text("ajuste_no_habil").notNull().default("siguiente_habil"),
    plazoEnMeses: boolean("plazo_en_meses").notNull().default(false),
    activa: boolean("activa").notNull().default(true),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    check("entidades_base_ck", sql`${t.baseCalculo} in ('calendario', 'comercial_360')`),
    check(
      "entidades_ajuste_ck",
      sql`${t.ajusteNoHabil} in ('siguiente_habil', 'anterior_habil', 'ninguno')`,
    ),
    check("entidades_monto_ck", sql`${t.montoMinimo} >= 0`),
  ],
);

export const condicionesTasa = pgTable(
  "condiciones_tasa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entidadId: text("entidad_id")
      .notNull()
      .references(() => entidades.id),
    plazoDias: integer("plazo_dias").notNull(),
    montoMin: pesos("monto_min").notNull(),
    montoMax: pesos("monto_max"),
    periodicidad: text("periodicidad", { enum: PERIODICIDADES }).notNull(),
    tasaEa: tasa("tasa_ea").notNull(),
    vigenteDesde: fecha("vigente_desde").notNull(),
    vigenteHasta: fecha("vigente_hasta"),
    creadoPor: uuid("creado_por").references(() => staffMembers.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    index("condiciones_busqueda_idx").on(t.entidadId, t.plazoDias, t.periodicidad),
    check("condiciones_plazo_ck", sql`${t.plazoDias} > 0`),
    check("condiciones_monto_ck", sql`${t.montoMin} >= 0`),
    check("condiciones_rango_ck", sql`${t.montoMax} is null or ${t.montoMax} >= ${t.montoMin}`),
    check("condiciones_tasa_ck", sql`${t.tasaEa} > 0`),
    check(
      "condiciones_vigencia_ck",
      sql`${t.vigenteHasta} is null or ${t.vigenteHasta} >= ${t.vigenteDesde}`,
    ),
    check(
      "condiciones_periodicidad_ck",
      sql`${t.periodicidad} in ('vencimiento', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual')`,
    ),
  ],
);

export const festivos = pgTable("festivos", {
  fecha: date("fecha", { mode: "string" }).primaryKey(),
  nombre: text("nombre").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------------------------
// Solicitudes, versiones, documentos y eventos
// ---------------------------------------------------------------------------------------------
export const solicitudes = pgTable(
  "solicitudes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    numero: bigserial("numero", { mode: "number" }).notNull(),
    codigo: text("codigo").generatedAlwaysAs(sql`'SOL-' || lpad(numero::text, 6, '0')`),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    asesorId: uuid("asesor_id").references(() => staffMembers.id, { onDelete: "set null" }),
    entidadId: text("entidad_id")
      .notNull()
      .references(() => entidades.id),
    estado: text("estado", { enum: ESTADOS_SOLICITUD }).notNull().default("borrador"),
    versionActual: integer("version_actual").notNull().default(0),
    datos: jsonb("datos").$type<Record<string, string>>().notNull().default({}),
    valor: pesos("valor"),
    plazoDias: integer("plazo_dias"),
    periodicidad: text("periodicidad", { enum: PERIODICIDADES }),
    tasaEa: tasa("tasa_ea"),
    fechaApertura: fecha("fecha_apertura"),
    fechaVenc: fecha("fecha_venc"),
    condicionId: uuid("condicion_id").references(() => condicionesTasa.id),
    aprobadaAt: timestamp("aprobada_at", { withTimezone: true }),
    aprobadaPor: uuid("aprobada_por").references(() => staffMembers.id, { onDelete: "set null" }),
    fechaEnvio: fecha("fecha_envio"),
    radicado: text("radicado"),
    observacion: text("observacion"),
    motivoCancelacion: text("motivo_cancelacion"),
    constituidaAt: timestamp("constituida_at", { withTimezone: true }),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("solicitudes_numero_uq").on(t.numero),
    uniqueIndex("solicitudes_codigo_uq").on(t.codigo),
    index("solicitudes_cliente_idx").on(t.clienteId),
    index("solicitudes_asesor_estado_idx").on(t.asesorId, t.estado),
    index("solicitudes_estado_idx").on(t.estado),
    index("solicitudes_creada_idx").on(t.createdAt),
    check(
      "solicitudes_estado_ck",
      sql`${t.estado} in ('borrador', 'pendiente_validacion', 'devuelta', 'pendiente_firma', 'firma_en_revision', 'lista_para_enviar', 'enviada_entidad', 'cdt_constituido', 'cancelada')`,
    ),
  ],
);

export const solicitudVersiones = pgTable(
  "solicitud_versiones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    numero: integer("numero").notNull(),
    datos: jsonb("datos").$type<Record<string, string>>().notNull(),
    condiciones: jsonb("condiciones").$type<Record<string, string | number>>().notNull(),
    motivo: text("motivo"),
    creadoPor: text("creado_por").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
  },
  (t) => [uniqueIndex("solicitud_versiones_numero_uq").on(t.solicitudId, t.numero)],
);

export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    version: integer("version").notNull(),
    tipo: text("tipo").notNull(),
    docKey: text("doc_key"),
    storagePath: text("storage_path").notNull().unique(),
    nombreArchivo: text("nombre_archivo").notNull(),
    sha256: text("sha256").notNull(),
    bytes: integer("bytes").notNull(),
    estado: text("estado").notNull().default("vigente"),
    motivoRechazo: text("motivo_rechazo"),
    subidoPor: text("subido_por").references(() => user.id, { onDelete: "set null" }),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    index("documentos_solicitud_version_idx").on(t.solicitudId, t.version),
    check("documentos_tipo_ck", sql`${t.tipo} in ('generado', 'firmado')`),
    check(
      "documentos_estado_ck",
      sql`${t.estado} in ('vigente', 'desactualizado', 'aceptado', 'rechazado')`,
    ),
  ],
);

export const solicitudEventos = pgTable(
  "solicitud_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    solicitudId: uuid("solicitud_id")
      .notNull()
      .references(() => solicitudes.id),
    tipo: text("tipo").notNull(),
    desde: text("desde"),
    hacia: text("hacia"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    nota: text("nota"),
    notificadoAt: timestamp("notificado_at", { withTimezone: true }),
    createdAt: creadoEn(),
  },
  (t) => [
    index("solicitud_eventos_solicitud_idx").on(t.solicitudId, t.createdAt),
    check("solicitud_eventos_tipo_ck", sql`${t.tipo} in ('transicion', 'nota', 'edicion')`),
  ],
);

// Solo inserción: un trigger (migración personalizada del paso 3) rechaza UPDATE, DELETE y
// TRUNCATE con SQLSTATE 42501. Sin FK a user a propósito: el rastro sobrevive al usuario.
export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id"),
    actorIp: text("actor_ip"),
    accion: text("accion").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [
    index("audit_events_target_idx").on(t.targetType, t.targetId),
    index("audit_events_fecha_idx").on(t.occurredAt),
    index("audit_events_actor_idx").on(t.actorId),
  ],
);

// ---------------------------------------------------------------------------------------------
// Portafolio e importación
// ---------------------------------------------------------------------------------------------
export const cdts = pgTable(
  "cdts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clienteId: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id),
    entidadId: text("entidad_id")
      .notNull()
      .references(() => entidades.id),
    numeroCdt: text("numero_cdt").notNull(),
    valor: pesos("valor").notNull(),
    tasaEa: tasa("tasa_ea").notNull(),
    fechaApertura: fecha("fecha_apertura").notNull(),
    fechaVenc: fecha("fecha_venc").notNull(),
    periodicidad: text("periodicidad", { enum: PERIODICIDADES }).notNull(),
    estado: text("estado").notNull().default("vigente"),
    origen: text("origen").notNull(),
    solicitudId: uuid("solicitud_id")
      .unique()
      .references(() => solicitudes.id),
    createdAt: creadoEn(),
    updatedAt: actualizadoEn(),
  },
  (t) => [
    uniqueIndex("cdts_entidad_numero_uq").on(t.entidadId, t.numeroCdt),
    index("cdts_cliente_idx").on(t.clienteId),
    index("cdts_vencimiento_idx").on(t.fechaVenc),
    check("cdts_estado_ck", sql`${t.estado} in ('vigente', 'vencido', 'cancelado')`),
    check("cdts_origen_ck", sql`${t.origen} in ('solicitud', 'importacion')`),
  ],
);

export const importPerfiles = pgTable("import_perfiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  nombre: text("nombre").notNull().unique(),
  mapeo: jsonb("mapeo").$type<Record<string, string>>().notNull(),
  creadoPor: uuid("creado_por").references(() => staffMembers.id, { onDelete: "set null" }),
  createdAt: creadoEn(),
  updatedAt: actualizadoEn(),
});

export const importCargas = pgTable("import_cargas", {
  id: uuid("id").primaryKey().defaultRandom(),
  perfilId: uuid("perfil_id")
    .notNull()
    .references(() => importPerfiles.id),
  archivoNombre: text("archivo_nombre").notNull(),
  filasCreadas: integer("filas_creadas").notNull().default(0),
  filasActualizadas: integer("filas_actualizadas").notNull().default(0),
  filasSinCambios: integer("filas_sin_cambios").notNull().default(0),
  filasRechazadas: integer("filas_rechazadas").notNull().default(0),
  rechazosStoragePath: text("rechazos_storage_path"),
  actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: creadoEn(),
});

// Contadores de límite de tasa por clave (p. ej. "otp:correo@x.com", "registro:ip:1.2.3.4").
export const rateLimits = pgTable("rate_limits", {
  clave: text("clave").primaryKey(),
  conteo: integer("conteo").notNull(),
  ventanaInicio: timestamp("ventana_inicio", { withTimezone: true }).notNull(),
});
