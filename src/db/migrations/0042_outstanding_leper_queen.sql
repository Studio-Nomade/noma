CREATE TABLE "service_package_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"variant_tier" text DEFAULT 'START' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"niche" text,
	"description" text,
	"status" "service_status" DEFAULT 'Activo' NOT NULL,
	"suggested_by_ai" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "service_subareas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" "area" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "service_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"service_id" uuid NOT NULL,
	"tier" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"audience" text,
	"focus" text,
	"description" text,
	"methodology" text,
	"deliverables" text,
	"exclusions" text,
	"estimated_time" text,
	"price_min_amount" numeric(14, 2),
	"price_max_amount" numeric(14, 2),
	"price_currency" "currency" DEFAULT 'UF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "exclusions" text;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_package_items_unique" ON "service_package_items" USING btree ("package_id","service_id","variant_tier");--> statement-breakpoint
CREATE INDEX "service_package_items_package_idx" ON "service_package_items" USING btree ("package_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "service_subareas_area_name_unique" ON "service_subareas" USING btree ("area","name");--> statement-breakpoint
CREATE INDEX "service_subareas_area_idx" ON "service_subareas" USING btree ("area","name");--> statement-breakpoint
CREATE UNIQUE INDEX "service_variants_service_tier_unique" ON "service_variants" USING btree ("service_id","tier");--> statement-breakpoint
CREATE INDEX "service_variants_service_idx" ON "service_variants" USING btree ("service_id");--> statement-breakpoint
INSERT INTO "service_subareas" ("area", "name")
SELECT DISTINCT "area", btrim("subarea")
FROM "services"
WHERE "subarea" IS NOT NULL AND btrim("subarea") <> ''
ON CONFLICT ("area", "name") DO NOTHING;--> statement-breakpoint
INSERT INTO "service_variants" (
	"service_id",
	"tier",
	"enabled",
	"description",
	"methodology",
	"deliverables",
	"exclusions",
	"estimated_time",
	"price_min_amount",
	"price_max_amount",
	"price_currency",
	"created_by"
)
SELECT
	s."id",
	t."tier",
	t."enabled",
	s."description",
	s."methodology",
	s."deliverables",
	s."exclusions",
	s."estimated_time",
	s."price_min_amount",
	s."price_max_amount",
	coalesce(s."price_currency", 'UF'::"currency"),
	s."created_by"
FROM "services" s
CROSS JOIN (
	VALUES
		('START', true),
		('GROWTH', true),
		('PERFORMANCE', false),
		('ENTERPRISE', false)
) AS t("tier", "enabled")
ON CONFLICT ("service_id", "tier") DO NOTHING;
