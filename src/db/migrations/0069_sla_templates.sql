CREATE TABLE "sla_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" "area" NOT NULL,
	"service_id" uuid,
	"name" text NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"service_block" jsonb,
	"variables" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"clauses" text,
	"status" "service_status" DEFAULT 'Activo' NOT NULL,
	"source_file" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "sla_templates" ADD CONSTRAINT "sla_templates_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sla_templates_area_idx" ON "sla_templates" USING btree ("area");--> statement-breakpoint
CREATE UNIQUE INDEX "sla_templates_area_default_unique" ON "sla_templates" USING btree ("area") WHERE "sla_templates"."service_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "sla_templates_service_unique" ON "sla_templates" USING btree ("service_id") WHERE "sla_templates"."service_id" is not null;