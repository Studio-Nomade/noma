CREATE TABLE "monthly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email_channel_id" uuid NOT NULL,
	"month" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"metrics" jsonb,
	"gmail_draft_id" text,
	"asana_task_gid" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_channels" ADD COLUMN "monthly_report" jsonb;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_email_channel_id_email_channels_id_fk" FOREIGN KEY ("email_channel_id") REFERENCES "public"."email_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "monthly_reports_channel_month_uq" ON "monthly_reports" USING btree ("email_channel_id","month");