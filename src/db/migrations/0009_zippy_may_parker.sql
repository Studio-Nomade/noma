CREATE TYPE "public"."sla_status" AS ENUM('Borrador', 'Revisado', 'Firmado', 'Enviado');--> statement-breakpoint
CREATE TABLE "slas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"project_id" uuid,
	"client_id" uuid,
	"status" "sla_status" DEFAULT 'Borrador' NOT NULL,
	"params" jsonb DEFAULT '{}'::jsonb,
	"sections" jsonb DEFAULT '[]'::jsonb,
	"signed_by_name" text,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "slas" ADD CONSTRAINT "slas_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slas" ADD CONSTRAINT "slas_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slas" ADD CONSTRAINT "slas_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;