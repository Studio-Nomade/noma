CREATE TABLE "payment_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"document_id" uuid,
	"sales_order_id" uuid,
	"amount" numeric(16, 2) NOT NULL,
	"paid_at" date NOT NULL,
	"reference" text,
	"status" text DEFAULT 'PENDIENTE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_document_id_fin_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."fin_documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reports" ADD CONSTRAINT "payment_reports_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_reports_client_idx" ON "payment_reports" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "payment_reports_status_idx" ON "payment_reports" USING btree ("status","created_at");