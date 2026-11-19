CREATE TABLE "asana_slack_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asana_project_gid" text NOT NULL,
	"asana_project_name" text NOT NULL,
	"slack_channel_id" text NOT NULL,
	"slack_channel_name" text NOT NULL,
	"folio_prefix" text,
	"events" jsonb DEFAULT '{"mention":true,"reopened":true,"state_change":true,"assigned":true,"completed":false,"new_task":true}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"asana_webhook_gid" text,
	"last_notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "asana_slack_links_asana_project_gid_unique" UNIQUE("asana_project_gid")
);
--> statement-breakpoint
CREATE TABLE "people_identities" (
	"email" text PRIMARY KEY NOT NULL,
	"asana_user_gid" text,
	"slack_user_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_notify_log" (
	"event_key" text PRIMARY KEY NOT NULL,
	"slack_channel_id" text,
	"slack_ts" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slack_task_threads" (
	"asana_task_gid" text PRIMARY KEY NOT NULL,
	"slack_channel_id" text NOT NULL,
	"thread_ts" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "people_identities_asana_idx" ON "people_identities" USING btree ("asana_user_gid");--> statement-breakpoint
ALTER TABLE "asana_slack_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "people_identities" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "slack_notify_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "slack_task_threads" ENABLE ROW LEVEL SECURITY;
