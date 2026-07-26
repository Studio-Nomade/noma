CREATE TYPE "public"."billing_item_status" AS ENUM('PENDIENTE', 'FACTURADO', 'PAGADO');--> statement-breakpoint
CREATE TYPE "public"."billing_item_type" AS ENUM('PORCENTAJE', 'MONTO');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('BORRADOR', 'ENVIADA', 'FACTURADA_PARCIAL', 'FACTURADA');--> statement-breakpoint
CREATE TABLE "sales_order_billing_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"label" text NOT NULL,
	"type" "billing_item_type" DEFAULT 'PORCENTAJE' NOT NULL,
	"value" numeric(16, 2) NOT NULL,
	"calculated_amount" numeric(16, 2) NOT NULL,
	"tentative_date" date,
	"deliverable" text,
	"status" "billing_item_status" DEFAULT 'PENDIENTE' NOT NULL,
	"invoice_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"business_line" "area" NOT NULL,
	"service_id" uuid,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"price_amount" numeric(16, 2) NOT NULL,
	"currency" "currency" DEFAULT 'UF' NOT NULL,
	"discount_amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(16, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folio" text NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"status" "sales_order_status" DEFAULT 'BORRADOR' NOT NULL,
	"emission_date" date NOT NULL,
	"due_date" date,
	"subtotal_amount" numeric(16, 2) NOT NULL,
	"iva_amount" numeric(16, 2) NOT NULL,
	"total_amount" numeric(16, 2) NOT NULL,
	"currency" "currency" DEFAULT 'CLP' NOT NULL,
	"notes" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "sales_orders_folio_unique" UNIQUE("folio"),
	CONSTRAINT "sales_orders_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
ALTER TABLE "sales_order_billing_items" ADD CONSTRAINT "sales_order_billing_items_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_billing_items" ADD CONSTRAINT "sales_order_billing_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_order_billing_items_order_idx" ON "sales_order_billing_items" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_order_billing_items_invoice_idx" ON "sales_order_billing_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "sales_order_lines_order_idx" ON "sales_order_lines" USING btree ("sales_order_id");--> statement-breakpoint
CREATE INDEX "sales_orders_client_idx" ON "sales_orders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "sales_orders_project_idx" ON "sales_orders" USING btree ("project_id");