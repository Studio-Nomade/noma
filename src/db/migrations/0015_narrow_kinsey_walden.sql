CREATE TYPE "public"."cobranza_moment" AS ENUM('INICIO', 'TERMINO', 'RECORDATORIO');--> statement-breakpoint
CREATE TYPE "public"."cobranza_status" AS ENUM('ENVIADO', 'PENDIENTE', 'ERROR');--> statement-breakpoint
CREATE TABLE "cobranza_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid,
	"project_id" uuid,
	"invoice_id" uuid,
	"template_id" uuid,
	"moment" "cobranza_moment" NOT NULL,
	"from_email" text NOT NULL,
	"to_email" text NOT NULL,
	"cc_emails" jsonb DEFAULT '[]'::jsonb,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "cobranza_status" DEFAULT 'PENDIENTE' NOT NULL,
	"error" text,
	"sent_by_id" uuid,
	"sent_by_email" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "cobranza_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"moment" "cobranza_moment" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "cobranza_messages" ADD CONSTRAINT "cobranza_messages_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobranza_messages" ADD CONSTRAINT "cobranza_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobranza_messages" ADD CONSTRAINT "cobranza_messages_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cobranza_messages" ADD CONSTRAINT "cobranza_messages_template_id_cobranza_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."cobranza_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cobranza_messages_client_idx" ON "cobranza_messages" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cobranza_messages_created_idx" ON "cobranza_messages" USING btree ("created_at");