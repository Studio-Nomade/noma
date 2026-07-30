CREATE TABLE "retainer_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retainer_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"quota" numeric(12, 2) NOT NULL,
	"consumed" numeric(12, 2) DEFAULT '0' NOT NULL,
	"remaining" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "retainers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"unit" text NOT NULL,
	"quota_per_period" numeric(12, 2) NOT NULL,
	"period_type" text DEFAULT 'monthly' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"rollover_policy" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "retainer_period_id" uuid;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "estimated_units" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "retainer_consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "scope_reason" text;--> statement-breakpoint
ALTER TABLE "retainer_periods" ADD CONSTRAINT "retainer_periods_retainer_id_retainers_id_fk" FOREIGN KEY ("retainer_id") REFERENCES "public"."retainers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainers" ADD CONSTRAINT "retainers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainers" ADD CONSTRAINT "retainers_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "retainer_periods_retainer_start_unique" ON "retainer_periods" USING btree ("retainer_id","period_start");--> statement-breakpoint
CREATE INDEX "retainer_periods_status_idx" ON "retainer_periods" USING btree ("status","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "retainers_active_project_unique" ON "retainers" USING btree ("project_id") WHERE "retainers"."status" = 'active';--> statement-breakpoint
CREATE INDEX "retainers_client_status_idx" ON "retainers" USING btree ("client_id","status");--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_retainer_period_id_retainer_periods_id_fk" FOREIGN KEY ("retainer_period_id") REFERENCES "public"."retainer_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_requests_retainer_period_idx" ON "client_requests" USING btree ("retainer_period_id");