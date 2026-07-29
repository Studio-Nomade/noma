CREATE TYPE "public"."ledger_account_kind" AS ENUM('CUENTA', 'SERVICIO', 'PRODUCTO');--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN "kind" "ledger_account_kind" DEFAULT 'CUENTA' NOT NULL;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "ledger_account_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_ledger_account_id_ledger_accounts_id_fk" FOREIGN KEY ("ledger_account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_service_id_unique" UNIQUE("service_id");--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_ledger_account_id_unique" UNIQUE("ledger_account_id");