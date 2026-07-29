ALTER TYPE "public"."invoice_status" ADD VALUE 'Por asignar NV';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'Por cobrar';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'Pagada';--> statement-breakpoint
ALTER TYPE "public"."invoice_status" ADD VALUE 'Reclamada';--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "payment_term_days" integer DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sales_order_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billing_item_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "estimated_payment_date" date;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_item_id_sales_order_billing_items_id_fk" FOREIGN KEY ("billing_item_id") REFERENCES "public"."sales_order_billing_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_sales_order_idx" ON "invoices" USING btree ("sales_order_id");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_item_id_unique" UNIQUE("billing_item_id");