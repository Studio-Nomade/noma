CREATE TYPE "public"."bank_txn_status" AS ENUM('PENDIENTE', 'CONCILIADO', 'PARCIAL', 'IGNORADO');--> statement-breakpoint
CREATE TYPE "public"."bank_txn_type" AS ENUM('ABONO', 'CARGO');--> statement-breakpoint
CREATE TYPE "public"."contact_type" AS ENUM('CLIENTE', 'PROVEEDOR', 'AMBOS');--> statement-breakpoint
CREATE TYPE "public"."document_direction" AS ENUM('VENTA', 'COMPRA');--> statement-breakpoint
CREATE TYPE "public"."fin_document_status" AS ENUM('EMITIDA', 'PAGADA', 'PARCIAL', 'VENCIDA', 'ANULADA', 'CONCILIADA');--> statement-breakpoint
CREATE TYPE "public"."fin_document_type" AS ENUM('FACTURA_VENTA', 'FACTURA_COMPRA', 'NOTA_CREDITO', 'NOTA_DEBITO', 'BOLETA', 'BOLETA_HONORARIOS');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('BORRADOR', 'CONFIRMADO', 'RECHAZADO');--> statement-breakpoint
CREATE TYPE "public"."import_type" AS ENUM('NUBOX_VENTAS', 'NUBOX_COMPRAS', 'CARTOLA_BANCARIA');--> statement-breakpoint
CREATE TYPE "public"."ledger_account_type" AS ENUM('INGRESO', 'COSTO', 'GASTO', 'ACTIVO', 'PASIVO', 'PATRIMONIO');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('ACTIVA', 'REVERTIDA');--> statement-breakpoint
CREATE TYPE "public"."record_status" AS ENUM('ACTIVO', 'ANULADO', 'IGNORADO', 'ARCHIVADO', 'ELIMINADO_LOGICO');--> statement-breakpoint
CREATE TYPE "public"."rule_match_field" AS ENUM('CONTACTO', 'RUT', 'GLOSA', 'MONTO');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank" text NOT NULL,
	"name" text NOT NULL,
	"number" text,
	"currency" "currency" DEFAULT 'CLP' NOT NULL,
	"saldo" numeric(16, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_account_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"glosa" text NOT NULL,
	"monto" numeric(16, 2) NOT NULL,
	"tipo" "bank_txn_type" NOT NULL,
	"saldo" numeric(16, 2),
	"status" "bank_txn_status" DEFAULT 'PENDIENTE' NOT NULL,
	"record_status" "record_status" DEFAULT 'ACTIVO' NOT NULL,
	"monto_conciliado" numeric(16, 2) DEFAULT '0' NOT NULL,
	"import_batch_id" uuid,
	"source_file" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "business_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "business_lines_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "classification_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"match_field" "rule_match_field" NOT NULL,
	"match_operator" text DEFAULT 'equals' NOT NULL,
	"match_value" text NOT NULL,
	"ledger_account_id" uuid,
	"cost_center_id" uuid,
	"business_line_id" uuid,
	"priority" integer DEFAULT 100 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "record_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fin_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rut" text NOT NULL,
	"name" text NOT NULL,
	"type" "contact_type" DEFAULT 'AMBOS' NOT NULL,
	"email" text,
	"client_id" uuid,
	"status" "record_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "fin_document_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"descripcion" text NOT NULL,
	"cantidad" numeric(16, 2) DEFAULT '1' NOT NULL,
	"precio" numeric(16, 2) DEFAULT '0' NOT NULL,
	"monto" numeric(16, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fin_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"direction" "document_direction" NOT NULL,
	"type" "fin_document_type" NOT NULL,
	"folio" text NOT NULL,
	"contact_id" uuid,
	"invoice_id" uuid,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date,
	"neto" numeric(16, 2) DEFAULT '0' NOT NULL,
	"iva" numeric(16, 2) DEFAULT '0' NOT NULL,
	"exento" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total" numeric(16, 2) DEFAULT '0' NOT NULL,
	"monto_conciliado" numeric(16, 2) DEFAULT '0' NOT NULL,
	"status" "fin_document_status" DEFAULT 'EMITIDA' NOT NULL,
	"record_status" "record_status" DEFAULT 'ACTIVO' NOT NULL,
	"periodo_sii" text,
	"ledger_account_id" uuid,
	"cost_center_id" uuid,
	"business_line_id" uuid,
	"import_batch_id" uuid,
	"source_file" text,
	"observacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "import_type" NOT NULL,
	"status" "import_status" DEFAULT 'BORRADOR' NOT NULL,
	"file_name" text NOT NULL,
	"storage_path" text,
	"rows_detected" integer DEFAULT 0 NOT NULL,
	"rows_valid" integer DEFAULT 0 NOT NULL,
	"rows_rejected" integer DEFAULT 0 NOT NULL,
	"rows_inserted" integer DEFAULT 0 NOT NULL,
	"total_neto" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_iva" numeric(16, 2) DEFAULT '0' NOT NULL,
	"total_bruto" numeric(16, 2) DEFAULT '0' NOT NULL,
	"summary" jsonb,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "import_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "import_type" NOT NULL,
	"column_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" "ledger_account_type" NOT NULL,
	"parent_id" uuid,
	"area" "area",
	"status" "record_status" DEFAULT 'ACTIVO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "ledger_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "reconciliation_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"amount_applied" numeric(16, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"bank_transaction_id" uuid NOT NULL,
	"amount_applied" numeric(16, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "reconciliation_status" DEFAULT 'ACTIVA' NOT NULL,
	"note" text,
	"difference" numeric(16, 2) DEFAULT '0' NOT NULL,
	"created_by_id" uuid,
	"reverted_by_id" uuid,
	"reverted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_business_line_id_business_lines_id_fk" FOREIGN KEY ("business_line_id") REFERENCES "public"."business_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_contacts" ADD CONSTRAINT "fin_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_document_lines" ADD CONSTRAINT "fin_document_lines_document_id_fin_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."fin_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_documents" ADD CONSTRAINT "fin_documents_contact_id_fin_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."fin_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_documents" ADD CONSTRAINT "fin_documents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_documents" ADD CONSTRAINT "fin_documents_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_documents" ADD CONSTRAINT "fin_documents_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_documents" ADD CONSTRAINT "fin_documents_business_line_id_business_lines_id_fk" FOREIGN KEY ("business_line_id") REFERENCES "public"."business_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fin_documents" ADD CONSTRAINT "fin_documents_import_batch_id_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_parent_id_ledger_accounts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_documents" ADD CONSTRAINT "reconciliation_documents_reconciliation_id_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."reconciliations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_documents" ADD CONSTRAINT "reconciliation_documents_document_id_fin_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."fin_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_transactions" ADD CONSTRAINT "reconciliation_transactions_reconciliation_id_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."reconciliations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_transactions" ADD CONSTRAINT "reconciliation_transactions_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_transactions_account_fecha_idx" ON "bank_transactions" USING btree ("bank_account_id","fecha");--> statement-breakpoint
CREATE INDEX "bank_transactions_status_idx" ON "bank_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "classification_rules_active_idx" ON "classification_rules" USING btree ("is_active","priority");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_contacts_rut_type_unique" ON "fin_contacts" USING btree ("rut","type");--> statement-breakpoint
CREATE INDEX "fin_contacts_name_idx" ON "fin_contacts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "fin_document_lines_document_idx" ON "fin_document_lines" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fin_documents_natural_unique" ON "fin_documents" USING btree ("direction","type","folio","contact_id");--> statement-breakpoint
CREATE INDEX "fin_documents_direction_fecha_idx" ON "fin_documents" USING btree ("direction","fecha_emision");--> statement-breakpoint
CREATE INDEX "fin_documents_status_idx" ON "fin_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fin_documents_periodo_idx" ON "fin_documents" USING btree ("periodo_sii");--> statement-breakpoint
CREATE INDEX "import_batches_type_status_idx" ON "import_batches" USING btree ("type","status");--> statement-breakpoint
CREATE INDEX "reconciliation_documents_doc_idx" ON "reconciliation_documents" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "reconciliation_transactions_txn_idx" ON "reconciliation_transactions" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "reconciliations_status_idx" ON "reconciliations" USING btree ("status");