CREATE TABLE "cobranza_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"last_followup_at" timestamp with time zone,
	"followup_count" integer DEFAULT 0 NOT NULL,
	"committed_payment_date" date,
	"factoring_entity" text,
	"factoring_at" date,
	"legal_at" date,
	"paused" boolean DEFAULT false NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "cobranza_cases_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
ALTER TABLE "cobranza_cases" ADD CONSTRAINT "cobranza_cases_document_id_fin_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."fin_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cobranza_cases_last_followup_idx" ON "cobranza_cases" USING btree ("last_followup_at");