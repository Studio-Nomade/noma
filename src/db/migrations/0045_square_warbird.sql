CREATE TABLE "email_studio_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"client_id" uuid NOT NULL,
	"noma_project_id" uuid,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_document" jsonb,
	"current_document_version" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_studio_projects_status_check" CHECK ("email_studio_projects"."status" in ('active', 'archived')),
	CONSTRAINT "email_studio_projects_document_version_check" CHECK ("email_studio_projects"."current_document_version" >= 0)
);
--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD CONSTRAINT "email_studio_projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD CONSTRAINT "email_studio_projects_noma_project_id_projects_id_fk" FOREIGN KEY ("noma_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_studio_projects_client_idx" ON "email_studio_projects" USING btree ("client_id","updated_at");--> statement-breakpoint
CREATE INDEX "email_studio_projects_status_idx" ON "email_studio_projects" USING btree ("status","updated_at");