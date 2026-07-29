CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"rut" text NOT NULL,
	"role_title" text NOT NULL,
	"area" "area",
	"status" text DEFAULT 'ACTIVO' NOT NULL,
	"base_salary_amount" numeric(16, 2) NOT NULL,
	"base_salary_currency" "currency" DEFAULT 'CLP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "employees_rut_unique" UNIQUE("rut")
);
--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("status","name");
--> statement-breakpoint
UPDATE "fin_documents"
SET "ledger_account_id" = (
  SELECT "id"
  FROM "ledger_accounts"
  WHERE "type" = 'GASTO' AND lower("name") LIKE '%honorario%'
  ORDER BY "code"
  LIMIT 1
)
WHERE "type" = 'BOLETA_HONORARIOS'
  AND "ledger_account_id" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "ledger_accounts"
    WHERE "type" = 'GASTO' AND lower("name") LIKE '%honorario%'
  );
