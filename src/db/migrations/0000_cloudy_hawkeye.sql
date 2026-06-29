CREATE TYPE "public"."area" AS ENUM('B&D', 'WD', 'A&D', 'A&A', 'CE', 'SN');--> statement-breakpoint
CREATE TYPE "public"."brief_status" AS ENUM('Borrador', 'Completado');--> statement-breakpoint
CREATE TYPE "public"."client_status" AS ENUM('Prospecto', 'Cliente activo', 'Cliente recurrente', 'Pausado', 'Cerrado');--> statement-breakpoint
CREATE TYPE "public"."commercial_stage" AS ENUM('Nuevo lead', 'Levantamiento', 'Diagnóstico', 'Propuesta', 'Negociación', 'Aprobado', 'Perdido', 'Stand by');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('CLP', 'USD', 'UF');--> statement-breakpoint
CREATE TYPE "public"."doc_category" AS ENUM('presupuesto', 'sla', 'proceso', 'plantilla', 'referencia', 'otro');--> statement-breakpoint
CREATE TYPE "public"."knowledge_category" AS ENUM('process', 'best-practice', 'tool-guide', 'onboarding');--> statement-breakpoint
CREATE TYPE "public"."link_entity_type" AS ENUM('client', 'project', 'proposal');--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('drive', 'figma', 'asana', 'notion', 'slack', 'canva', 'meet', 'calendar', 'other');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('Alta', 'Media', 'Baja');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('Levantamiento', 'Brief recibido', 'Propuesta en desarrollo', 'Propuesta enviada', 'Aprobado', 'En desarrollo', 'Pausado', 'Cerrado');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('Borrador', 'En revisión', 'Enviada', 'Aprobada', 'Rechazada');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('Activo', 'Inactivo');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('admin', 'user');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid,
	"area" "area" NOT NULL,
	"project_name" text,
	"main_objective" text,
	"problem" text,
	"target_audience" text,
	"expected_outcome" text,
	"ideal_deadline" text,
	"budget_amount" numeric(14, 2),
	"budget_currency" "currency" DEFAULT 'UF',
	"available_materials" text,
	"general_comments" text,
	"specific_fields" jsonb DEFAULT '{}'::jsonb,
	"status" "brief_status" DEFAULT 'Borrador' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text,
	"contact_role" text,
	"email" text,
	"phone" text,
	"industry" text,
	"website" text,
	"instagram" text,
	"linkedin" text,
	"status" "client_status" DEFAULT 'Prospecto' NOT NULL,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "context_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"doc_category" "doc_category" DEFAULT 'otro' NOT NULL,
	"area" "area",
	"tags" jsonb DEFAULT '[]'::jsonb,
	"storage_path" text,
	"mime_type" text,
	"source" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"uf_clp" numeric(14, 4),
	"usd_clp" numeric(14, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"area" "area",
	"category" "knowledge_category" DEFAULT 'process' NOT NULL,
	"content" text,
	"links" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid NOT NULL,
	"area" "area" NOT NULL,
	"project_type" text,
	"description" text,
	"main_objective" text,
	"start_date" date,
	"delivery_date" date,
	"budget_amount" numeric(14, 2),
	"budget_currency" "currency" DEFAULT 'UF',
	"status" "project_status" DEFAULT 'Levantamiento' NOT NULL,
	"commercial_stage" "commercial_stage" DEFAULT 'Nuevo lead' NOT NULL,
	"priority" "priority" DEFAULT 'Media' NOT NULL,
	"responsible_id" uuid,
	"next_action" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "proposal_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"custom_price_amount" numeric(14, 2),
	"custom_price_currency" "currency"
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"context" text,
	"diagnosis" text,
	"main_objective" text,
	"specific_objectives" text,
	"scope" text,
	"work_stages" text,
	"deliverables" text,
	"timeline" text,
	"client_requirements" text,
	"exclusions" text,
	"team" text,
	"commercial_conditions" text,
	"estimated_value_amount" numeric(14, 2),
	"estimated_value_currency" "currency" DEFAULT 'UF',
	"status" "proposal_status" DEFAULT 'Borrador' NOT NULL,
	"next_action" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "resource_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "link_entity_type" NOT NULL,
	"entity_id" uuid NOT NULL,
	"type" "link_type" DEFAULT 'other' NOT NULL,
	"label" text,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" "area" NOT NULL,
	"description" text,
	"deliverables" text,
	"estimated_time" text,
	"price_min_amount" numeric(14, 2),
	"price_max_amount" numeric(14, 2),
	"price_currency" "currency" DEFAULT 'UF',
	"requirements" text,
	"status" "service_status" DEFAULT 'Activo' NOT NULL,
	"related_services" uuid[] DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "studio_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"studio_name" text DEFAULT 'Studio Nomade' NOT NULL,
	"tagline" text,
	"email" text,
	"phone" text,
	"website" text,
	"address" text,
	"commercial_conditions_template" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"team_role" "team_role" DEFAULT 'user' NOT NULL,
	"area" "area",
	"email" text,
	"status" text DEFAULT 'Activo' NOT NULL,
	"tools" jsonb DEFAULT '[]'::jsonb,
	"access_references" jsonb DEFAULT '[]'::jsonb,
	"repos" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "briefs" ADD CONSTRAINT "briefs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_responsible_id_team_members_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_services" ADD CONSTRAINT "proposal_services_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_services" ADD CONSTRAINT "proposal_services_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_created_idx" ON "activity_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "briefs_project_id_unique" ON "briefs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_date_unique" ON "exchange_rates" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_services_unique" ON "proposal_services" USING btree ("proposal_id","service_id");--> statement-breakpoint
CREATE INDEX "resource_links_entity_idx" ON "resource_links" USING btree ("entity_type","entity_id");