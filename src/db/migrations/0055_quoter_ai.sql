ALTER TYPE "public"."service_status" ADD VALUE 'En revisión';--> statement-breakpoint
CREATE TABLE "proposal_precedents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"proposal_id" uuid,
	"source_key" text,
	"code" text,
	"client_name" text,
	"client_id" uuid,
	"issued_on" date,
	"areas" "area"[] DEFAULT '{}' NOT NULL,
	"title" text,
	"summary" text,
	"lines" jsonb DEFAULT '[]'::jsonb,
	"total_uf" numeric(14, 2),
	"conditions" text,
	"outcome" text,
	"raw_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "proposal_precedents_proposal_id_unique" UNIQUE("proposal_id"),
	CONSTRAINT "proposal_precedents_source_key_unique" UNIQUE("source_key"),
	CONSTRAINT "proposal_precedents_source_check" CHECK ("proposal_precedents"."source" in ('historico', 'noma'))
);
--> statement-breakpoint
CREATE TABLE "quoter_learnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"scope" text DEFAULT 'global' NOT NULL,
	"area" "area",
	"service_id" uuid,
	"client_id" uuid,
	"industry" text,
	"statement" text NOT NULL,
	"rationale" text,
	"origin" text NOT NULL,
	"source_proposal_id" uuid,
	"source_run_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"times_applied" integer DEFAULT 0 NOT NULL,
	"last_applied_at" timestamp with time zone,
	"created_by" uuid,
	"created_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quoter_learnings_kind_check" CHECK ("quoter_learnings"."kind" in ('precio', 'alcance', 'condiciones', 'redaccion', 'catalogo', 'proceso')),
	CONSTRAINT "quoter_learnings_scope_check" CHECK ("quoter_learnings"."scope" in ('global', 'area', 'servicio', 'cliente', 'rubro')),
	CONSTRAINT "quoter_learnings_origin_check" CHECK ("quoter_learnings"."origin" in ('ia', 'equipo')),
	CONSTRAINT "quoter_learnings_statement_not_blank" CHECK (btrim("quoter_learnings"."statement") <> '')
);
--> statement-breakpoint
CREATE TABLE "quoter_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"project_id" uuid,
	"proposal_id" uuid,
	"provider" text,
	"model" text,
	"context_refs" jsonb DEFAULT '{}'::jsonb,
	"output" jsonb,
	"error" text,
	"duration_ms" integer,
	"created_by" uuid,
	"created_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "quoter_runs_kind_check" CHECK ("quoter_runs"."kind" in ('brief', 'draft', 'learning')),
	CONSTRAINT "quoter_runs_status_check" CHECK ("quoter_runs"."status" in ('running', 'done', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "suggested_by_ai" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "origin_proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "proposal_precedents" ADD CONSTRAINT "proposal_precedents_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_precedents" ADD CONSTRAINT "proposal_precedents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoter_learnings" ADD CONSTRAINT "quoter_learnings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoter_learnings" ADD CONSTRAINT "quoter_learnings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoter_learnings" ADD CONSTRAINT "quoter_learnings_source_proposal_id_proposals_id_fk" FOREIGN KEY ("source_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoter_learnings" ADD CONSTRAINT "quoter_learnings_source_run_id_quoter_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."quoter_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoter_runs" ADD CONSTRAINT "quoter_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quoter_runs" ADD CONSTRAINT "quoter_runs_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_precedents_client_idx" ON "proposal_precedents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "quoter_learnings_active_idx" ON "quoter_learnings" USING btree ("active","scope");--> statement-breakpoint
CREATE INDEX "quoter_runs_project_idx" ON "quoter_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "quoter_runs_proposal_idx" ON "quoter_runs" USING btree ("proposal_id");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_origin_proposal_id_proposals_id_fk" FOREIGN KEY ("origin_proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;