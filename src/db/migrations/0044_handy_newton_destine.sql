WITH "package_item_totals" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "package_id", "service_id"
			ORDER BY "position", "id"
		) AS "row_number",
		sum(greatest("quantity", 1)) OVER (
			PARTITION BY "package_id", "service_id"
		) AS "total_quantity"
	FROM "service_package_items"
)
UPDATE "service_package_items" AS "item"
SET "quantity" = least("totals"."total_quantity", 99)
FROM "package_item_totals" AS "totals"
WHERE "item"."id" = "totals"."id" AND "totals"."row_number" = 1;--> statement-breakpoint
WITH "duplicate_package_items" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "package_id", "service_id"
			ORDER BY "position", "id"
		) AS "row_number"
	FROM "service_package_items"
)
DELETE FROM "service_package_items"
USING "duplicate_package_items"
WHERE "service_package_items"."id" = "duplicate_package_items"."id"
	AND "duplicate_package_items"."row_number" > 1;--> statement-breakpoint
UPDATE "service_package_items"
SET
	"variant_tier" = CASE
		WHEN "variant_tier" IN ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE')
			THEN "variant_tier"
		ELSE 'START'
	END,
	"quantity" = least(greatest("quantity", 1), 99),
	"position" = greatest("position", 0);--> statement-breakpoint
UPDATE "proposal_services"
SET
	"variant_tier" = CASE
		WHEN "variant_tier" IN ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE')
			THEN "variant_tier"
		ELSE 'START'
	END,
	"quantity" = least(greatest("quantity", 1), 999);--> statement-breakpoint
UPDATE "service_variants"
SET
	"price_min_amount" = CASE
		WHEN "price_min_amount" < 0 THEN NULL
		ELSE "price_min_amount"
	END,
	"price_max_amount" = CASE
		WHEN "price_max_amount" < 0 THEN NULL
		WHEN "price_min_amount" IS NOT NULL
			AND "price_max_amount" IS NOT NULL
			AND "price_max_amount" < greatest("price_min_amount", 0)
			THEN greatest("price_min_amount", 0)
		ELSE "price_max_amount"
	END;--> statement-breakpoint
DROP INDEX "service_package_items_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "service_package_items_unique" ON "service_package_items" USING btree ("package_id","service_id");--> statement-breakpoint
ALTER TABLE "proposal_services" ADD CONSTRAINT "proposal_services_variant_tier_check" CHECK ("proposal_services"."variant_tier" in ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE'));--> statement-breakpoint
ALTER TABLE "proposal_services" ADD CONSTRAINT "proposal_services_quantity_check" CHECK ("proposal_services"."quantity" between 1 and 999);--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_tier_check" CHECK ("service_package_items"."variant_tier" in ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE'));--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_quantity_check" CHECK ("service_package_items"."quantity" between 1 and 99);--> statement-breakpoint
ALTER TABLE "service_package_items" ADD CONSTRAINT "service_package_items_position_check" CHECK ("service_package_items"."position" >= 0);--> statement-breakpoint
ALTER TABLE "service_subareas" ADD CONSTRAINT "service_subareas_name_not_blank" CHECK (btrim("service_subareas"."name") <> '');--> statement-breakpoint
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_tier_check" CHECK ("service_variants"."tier" in ('START', 'GROWTH', 'PERFORMANCE', 'ENTERPRISE'));--> statement-breakpoint
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_price_min_nonnegative" CHECK ("service_variants"."price_min_amount" is null or "service_variants"."price_min_amount" >= 0);--> statement-breakpoint
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_price_max_nonnegative" CHECK ("service_variants"."price_max_amount" is null or "service_variants"."price_max_amount" >= 0);--> statement-breakpoint
ALTER TABLE "service_variants" ADD CONSTRAINT "service_variants_price_range_check" CHECK ("service_variants"."price_min_amount" is null or "service_variants"."price_max_amount" is null or "service_variants"."price_max_amount" >= "service_variants"."price_min_amount");
