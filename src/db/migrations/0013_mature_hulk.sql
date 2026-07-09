CREATE TYPE "public"."cfo_request_status" AS ENUM('Pendiente', 'En revisión', 'Aprobada', 'Rechazada');--> statement-breakpoint
CREATE TABLE "cfo_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"proposal_id" uuid,
	"client_id" uuid,
	"status" "cfo_request_status" DEFAULT 'Pendiente' NOT NULL,
	"notes" text,
	"requested_by" uuid,
	"requested_by_email" text,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "cfo_requests" ADD CONSTRAINT "cfo_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfo_requests" ADD CONSTRAINT "cfo_requests_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cfo_requests" ADD CONSTRAINT "cfo_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cfo_requests_project_idx" ON "cfo_requests" USING btree ("project_id");