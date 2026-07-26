CREATE TABLE "reconciliation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"match_type" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "classification_rules" ADD COLUMN "execution_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "classification_rules" ADD COLUMN "last_run_at" timestamp with time zone;
--> statement-breakpoint
INSERT INTO "reconciliation_rules" ("name", "match_type")
VALUES
  ('Coincidencia por RUT', 'RUT'),
  ('Coincidencia por monto exacto', 'MONTO'),
  ('Coincidencia por folio', 'FOLIO'),
  ('Coincidencia por descripción', 'DESCRIPCION');
