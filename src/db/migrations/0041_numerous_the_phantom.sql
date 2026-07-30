ALTER TABLE "proposals" ADD COLUMN "include_monthly_fee_condition" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "methodology" text;