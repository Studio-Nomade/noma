CREATE TABLE "area_email_projects" (
	"asana_project_gid" text PRIMARY KEY NOT NULL,
	"area_code" text NOT NULL,
	"area_label" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "area_email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asana_story_gid" text NOT NULL,
	"asana_task_gid" text NOT NULL,
	"asana_project_gid" text NOT NULL,
	"kind" text NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"via" text,
	"from_email" text,
	"to_emails" text[],
	"cc_emails" text[],
	"subject" text,
	"gmail_message_id" text,
	"gmail_thread_id" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "area_email_sends_asana_story_gid_unique" UNIQUE("asana_story_gid")
);
--> statement-breakpoint
CREATE TABLE "area_email_threads" (
	"asana_task_gid" text PRIMARY KEY NOT NULL,
	"asana_project_gid" text NOT NULL,
	"subject_base" text NOT NULL,
	"contact_email" text NOT NULL,
	"threads" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_round" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE INDEX "area_email_sends_task_idx" ON "area_email_sends" USING btree ("asana_task_gid");--> statement-breakpoint
CREATE INDEX "area_email_sends_status_idx" ON "area_email_sends" USING btree ("status");