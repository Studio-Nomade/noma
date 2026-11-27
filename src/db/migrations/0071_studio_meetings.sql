CREATE TABLE "studio_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slack_channel_id" text NOT NULL,
	"slack_thread_ts" text NOT NULL,
	"requester_email" text NOT NULL,
	"status" text DEFAULT 'propuesta' NOT NULL,
	"title" text NOT NULL,
	"area" text,
	"client_name" text,
	"meeting_type" text,
	"starts_at" timestamp with time zone,
	"duration_min" integer DEFAULT 30 NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unresolved" text[] DEFAULT '{}' NOT NULL,
	"agenda" text,
	"organizer_email" text,
	"calendar_event_id" text,
	"calendar_link" text,
	"meet_link" text,
	"drive_folder_id" text,
	"notes_file_id" text,
	"minutes" jsonb,
	"minutes_doc_id" text,
	"gmail_draft_id" text,
	"pending_change" jsonb,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE UNIQUE INDEX "studio_meetings_thread_uq" ON "studio_meetings" USING btree ("slack_channel_id","slack_thread_ts");--> statement-breakpoint
CREATE INDEX "studio_meetings_status_idx" ON "studio_meetings" USING btree ("status");--> statement-breakpoint
ALTER TABLE "studio_meetings" ENABLE ROW LEVEL SECURITY;