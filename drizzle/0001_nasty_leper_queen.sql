CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text,
	"actor_ip" text,
	"accion" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cdts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"entidad_id" text NOT NULL,
	"numero_cdt" text NOT NULL,
	"valor" bigint NOT NULL,
	"tasa_ea" numeric(6, 4) NOT NULL,
	"fecha_apertura" date NOT NULL,
	"fecha_venc" date NOT NULL,
	"periodicidad" text NOT NULL,
	"estado" text DEFAULT 'vigente' NOT NULL,
	"origen" text NOT NULL,
	"solicitud_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cdts_solicitud_id_unique" UNIQUE("solicitud_id"),
	CONSTRAINT "cdts_estado_ck" CHECK ("cdts"."estado" in ('vigente', 'vencido', 'cancelado')),
	CONSTRAINT "cdts_origen_ck" CHECK ("cdts"."origen" in ('solicitud', 'importacion'))
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"tipo_doc" text NOT NULL,
	"num_doc" text NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"celular" text,
	"asesor_id" uuid,
	"origen" text DEFAULT 'registro' NOT NULL,
	"perfil" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "clientes_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "clientes_tipo_doc_ck" CHECK ("clientes"."tipo_doc" in ('CC', 'CE', 'TI', 'PAS', 'NUIP')),
	CONSTRAINT "clientes_origen_ck" CHECK ("clientes"."origen" in ('registro', 'invitacion', 'importacion'))
);
--> statement-breakpoint
CREATE TABLE "condiciones_tasa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidad_id" text NOT NULL,
	"plazo_dias" integer NOT NULL,
	"monto_min" bigint NOT NULL,
	"monto_max" bigint,
	"periodicidad" text NOT NULL,
	"tasa_ea" numeric(6, 4) NOT NULL,
	"vigente_desde" date NOT NULL,
	"vigente_hasta" date,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "condiciones_plazo_ck" CHECK ("condiciones_tasa"."plazo_dias" > 0),
	CONSTRAINT "condiciones_monto_ck" CHECK ("condiciones_tasa"."monto_min" >= 0),
	CONSTRAINT "condiciones_rango_ck" CHECK ("condiciones_tasa"."monto_max" is null or "condiciones_tasa"."monto_max" >= "condiciones_tasa"."monto_min"),
	CONSTRAINT "condiciones_tasa_ck" CHECK ("condiciones_tasa"."tasa_ea" > 0),
	CONSTRAINT "condiciones_vigencia_ck" CHECK ("condiciones_tasa"."vigente_hasta" is null or "condiciones_tasa"."vigente_hasta" >= "condiciones_tasa"."vigente_desde"),
	CONSTRAINT "condiciones_periodicidad_ck" CHECK ("condiciones_tasa"."periodicidad" in ('vencimiento', 'mensual', 'bimestral', 'trimestral', 'semestral', 'anual'))
);
--> statement-breakpoint
CREATE TABLE "consentimientos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cliente_id" uuid,
	"version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"tipo" text NOT NULL,
	"doc_key" text,
	"storage_path" text NOT NULL,
	"nombre_archivo" text NOT NULL,
	"sha256" text NOT NULL,
	"bytes" integer NOT NULL,
	"estado" text DEFAULT 'vigente' NOT NULL,
	"motivo_rechazo" text,
	"subido_por" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documentos_storage_path_unique" UNIQUE("storage_path"),
	CONSTRAINT "documentos_tipo_ck" CHECK ("documentos"."tipo" in ('generado', 'firmado')),
	CONSTRAINT "documentos_estado_ck" CHECK ("documentos"."estado" in ('vigente', 'desactualizado', 'aceptado', 'rechazado'))
);
--> statement-breakpoint
CREATE TABLE "entidades" (
	"id" text PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"doc_keys" text[] NOT NULL,
	"monto_minimo" bigint DEFAULT 0 NOT NULL,
	"base_calculo" text DEFAULT 'calendario' NOT NULL,
	"ajuste_no_habil" text DEFAULT 'siguiente_habil' NOT NULL,
	"plazo_en_meses" boolean DEFAULT false NOT NULL,
	"activa" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entidades_base_ck" CHECK ("entidades"."base_calculo" in ('calendario', 'comercial_360')),
	CONSTRAINT "entidades_ajuste_ck" CHECK ("entidades"."ajuste_no_habil" in ('siguiente_habil', 'anterior_habil', 'ninguno')),
	CONSTRAINT "entidades_monto_ck" CHECK ("entidades"."monto_minimo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "import_cargas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"perfil_id" uuid NOT NULL,
	"archivo_nombre" text NOT NULL,
	"filas_creadas" integer DEFAULT 0 NOT NULL,
	"filas_actualizadas" integer DEFAULT 0 NOT NULL,
	"filas_sin_cambios" integer DEFAULT 0 NOT NULL,
	"filas_rechazadas" integer DEFAULT 0 NOT NULL,
	"rechazos_storage_path" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_perfiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"mapeo" jsonb NOT NULL,
	"creado_por" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_perfiles_nombre_unique" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "invitaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"asesor_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitaciones_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"clave" text PRIMARY KEY NOT NULL,
	"conteo" integer NOT NULL,
	"ventana_inicio" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "solicitud_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"desde" text,
	"hacia" text,
	"actor_user_id" text,
	"nota" text,
	"notificado_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "solicitud_eventos_tipo_ck" CHECK ("solicitud_eventos"."tipo" in ('transicion', 'nota', 'edicion'))
);
--> statement-breakpoint
CREATE TABLE "solicitud_versiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"solicitud_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"datos" jsonb NOT NULL,
	"condiciones" jsonb NOT NULL,
	"motivo" text,
	"creado_por" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "solicitudes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"numero" bigserial NOT NULL,
	"codigo" text GENERATED ALWAYS AS ('SOL-' || lpad(numero::text, 6, '0')) STORED,
	"cliente_id" uuid NOT NULL,
	"asesor_id" uuid,
	"entidad_id" text NOT NULL,
	"estado" text DEFAULT 'borrador' NOT NULL,
	"version_actual" integer DEFAULT 0 NOT NULL,
	"datos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"valor" bigint,
	"plazo_dias" integer,
	"periodicidad" text,
	"tasa_ea" numeric(6, 4),
	"fecha_apertura" date,
	"fecha_venc" date,
	"condicion_id" uuid,
	"aprobada_at" timestamp with time zone,
	"aprobada_por" uuid,
	"fecha_envio" date,
	"radicado" text,
	"observacion" text,
	"motivo_cancelacion" text,
	"constituida_at" timestamp with time zone,
	"creado_por" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "solicitudes_estado_ck" CHECK ("solicitudes"."estado" in ('borrador', 'pendiente_validacion', 'devuelta', 'pendiente_firma', 'firma_en_revision', 'lista_para_enviar', 'enviada_entidad', 'cdt_constituido', 'cancelada'))
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_members_rol_ck" CHECK ("staff_members"."rol" in ('asesor', 'coordinador', 'gerencia', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdts" ADD CONSTRAINT "cdts_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdts" ADD CONSTRAINT "cdts_entidad_id_entidades_id_fk" FOREIGN KEY ("entidad_id") REFERENCES "public"."entidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cdts" ADD CONSTRAINT "cdts_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_asesor_id_staff_members_id_fk" FOREIGN KEY ("asesor_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condiciones_tasa" ADD CONSTRAINT "condiciones_tasa_entidad_id_entidades_id_fk" FOREIGN KEY ("entidad_id") REFERENCES "public"."entidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condiciones_tasa" ADD CONSTRAINT "condiciones_tasa_creado_por_staff_members_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consentimientos" ADD CONSTRAINT "consentimientos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_user_id_fk" FOREIGN KEY ("subido_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_cargas" ADD CONSTRAINT "import_cargas_perfil_id_import_perfiles_id_fk" FOREIGN KEY ("perfil_id") REFERENCES "public"."import_perfiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_cargas" ADD CONSTRAINT "import_cargas_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_perfiles" ADD CONSTRAINT "import_perfiles_creado_por_staff_members_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_asesor_id_staff_members_id_fk" FOREIGN KEY ("asesor_id") REFERENCES "public"."staff_members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitud_eventos" ADD CONSTRAINT "solicitud_eventos_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitud_eventos" ADD CONSTRAINT "solicitud_eventos_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitud_versiones" ADD CONSTRAINT "solicitud_versiones_solicitud_id_solicitudes_id_fk" FOREIGN KEY ("solicitud_id") REFERENCES "public"."solicitudes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitud_versiones" ADD CONSTRAINT "solicitud_versiones_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_asesor_id_staff_members_id_fk" FOREIGN KEY ("asesor_id") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_entidad_id_entidades_id_fk" FOREIGN KEY ("entidad_id") REFERENCES "public"."entidades"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_condicion_id_condiciones_tasa_id_fk" FOREIGN KEY ("condicion_id") REFERENCES "public"."condiciones_tasa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_aprobada_por_staff_members_id_fk" FOREIGN KEY ("aprobada_por") REFERENCES "public"."staff_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "solicitudes" ADD CONSTRAINT "solicitudes_creado_por_user_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_members" ADD CONSTRAINT "staff_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_events_target_idx" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "audit_events_fecha_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cdts_entidad_numero_uq" ON "cdts" USING btree ("entidad_id","numero_cdt");--> statement-breakpoint
CREATE INDEX "cdts_cliente_idx" ON "cdts" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "cdts_vencimiento_idx" ON "cdts" USING btree ("fecha_venc");--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_documento_uq" ON "clientes" USING btree ("tipo_doc","num_doc");--> statement-breakpoint
CREATE INDEX "clientes_asesor_idx" ON "clientes" USING btree ("asesor_id");--> statement-breakpoint
CREATE INDEX "clientes_email_idx" ON "clientes" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "condiciones_busqueda_idx" ON "condiciones_tasa" USING btree ("entidad_id","plazo_dias","periodicidad");--> statement-breakpoint
CREATE UNIQUE INDEX "consentimientos_usuario_version_uq" ON "consentimientos" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "documentos_solicitud_version_idx" ON "documentos" USING btree ("solicitud_id","version");--> statement-breakpoint
CREATE INDEX "invitaciones_cliente_idx" ON "invitaciones" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "solicitud_eventos_solicitud_idx" ON "solicitud_eventos" USING btree ("solicitud_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitud_versiones_numero_uq" ON "solicitud_versiones" USING btree ("solicitud_id","numero");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitudes_numero_uq" ON "solicitudes" USING btree ("numero");--> statement-breakpoint
CREATE UNIQUE INDEX "solicitudes_codigo_uq" ON "solicitudes" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "solicitudes_cliente_idx" ON "solicitudes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "solicitudes_asesor_estado_idx" ON "solicitudes" USING btree ("asesor_id","estado");--> statement-breakpoint
CREATE INDEX "solicitudes_estado_idx" ON "solicitudes" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "solicitudes_creada_idx" ON "solicitudes" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_members_email_uq" ON "staff_members" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");