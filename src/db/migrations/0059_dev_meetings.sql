CREATE TABLE "dev_meeting_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cadence" text DEFAULT 'adhoc' NOT NULL,
	"weekday" integer,
	"time_of_day" text,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"contact_ids" uuid[] DEFAULT '{}' NOT NULL,
	"extra_emails" text[] DEFAULT '{}' NOT NULL,
	"agenda_template" text,
	"produces_backlog" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"meeting_type_id" uuid,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"duration_min" integer DEFAULT 60 NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agenda" text,
	"organizer_email" text,
	"calendar_event_id" text,
	"calendar_link" text,
	"meet_link" text,
	"status" text DEFAULT 'agendada' NOT NULL,
	"transcript_file_id" text,
	"minutes_doc_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "dev_meeting_types" ADD CONSTRAINT "dev_meeting_types_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_meetings" ADD CONSTRAINT "dev_meetings_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_meetings" ADD CONSTRAINT "dev_meetings_meeting_type_id_dev_meeting_types_id_fk" FOREIGN KEY ("meeting_type_id") REFERENCES "public"."dev_meeting_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dev_meeting_types_program_idx" ON "dev_meeting_types" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "dev_meetings_program_starts_idx" ON "dev_meetings" USING btree ("program_id","starts_at");--> statement-breakpoint
CREATE INDEX "dev_meetings_status_idx" ON "dev_meetings" USING btree ("status");