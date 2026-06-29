CREATE TYPE "public"."complexity_level" AS ENUM('Light', 'Medium', 'Regular', 'Bold');--> statement-breakpoint
CREATE TYPE "public"."price_type" AS ENUM('uf', 'unit', 'range', 'variable');--> statement-breakpoint
ALTER TYPE "public"."area" ADD VALUE 'MP' BEFORE 'SN';--> statement-breakpoint
CREATE TABLE "service_module_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"module_id" uuid NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"included_by_default" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" "area" NOT NULL,
	"subarea" text,
	"description" text,
	"deliverables" text,
	"estimated_time" text,
	"price_amount" numeric(14, 2),
	"price_currency" "currency" DEFAULT 'UF',
	"can_be_sold_independently" boolean DEFAULT true NOT NULL,
	"status" "service_status" DEFAULT 'Activo' NOT NULL,
	"source_file" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "subarea" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "complexity_level" "complexity_level";--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "price_type" "price_type" DEFAULT 'uf' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "is_composite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "source_file" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "source_year" text;--> statement-breakpoint
ALTER TABLE "service_module_links" ADD CONSTRAINT "service_module_links_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_module_links" ADD CONSTRAINT "service_module_links_module_id_service_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."service_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_module_links_service_idx" ON "service_module_links" USING btree ("service_id");