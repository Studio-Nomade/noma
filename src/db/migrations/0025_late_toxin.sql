CREATE TYPE "public"."discount_kind" AS ENUM('percent', 'clp', 'uf');--> statement-breakpoint
CREATE TYPE "public"."service_priority" AS ENUM('Normal', 'Prioridad', 'Contra Reloj', 'Crítico');--> statement-breakpoint
ALTER TABLE "proposal_services" ADD COLUMN "quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_services" ADD COLUMN "priority" "service_priority" DEFAULT 'Normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "discount_label" text;--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "discount_kind" "discount_kind";--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "discount_value" numeric(14, 2);