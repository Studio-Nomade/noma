CREATE TYPE "public"."financial_status" AS ENUM('Sin información', 'Al día', 'Con saldo pendiente', 'Moroso');--> statement-breakpoint
CREATE TYPE "public"."integration" AS ENUM('chipax', 'nubox');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('No facturado', 'Preparado para facturar', 'Borrador creado en Nubox', 'Emitido', 'Pagado', 'Vencido', 'Anulado');--> statement-breakpoint
CREATE TABLE "integration_sync_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration" "integration" NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"action" text NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid,
	"proposal_id" uuid,
	"status" "invoice_status" DEFAULT 'No facturado' NOT NULL,
	"nubox_id" text,
	"folio" text,
	"glosa" text,
	"payment_terms" text,
	"currency" "currency" DEFAULT 'CLP',
	"net_amount" numeric(14, 2),
	"iva_amount" numeric(14, 2),
	"total_amount" numeric(14, 2),
	"balance_due" numeric(14, 2),
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"document_created_at" timestamp with time zone,
	"issued_at" date,
	"due_at" date,
	"paid_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "rut" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "legal_name" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "tax_activity" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "tax_address" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_email" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "billing_notes" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "financial_status" "financial_status" DEFAULT 'Sin información';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "chipax_id" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "integration_sync_log_idx" ON "integration_sync_log" USING btree ("integration","created_at");--> statement-breakpoint
CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "invoices_project_idx" ON "invoices" USING btree ("project_id");