CREATE TABLE "dev_backlog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"meeting_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"raised_by" text,
	"area" text,
	"type" text,
	"environment" text,
	"priority" text DEFAULT 'Normal' NOT NULL,
	"evidence" text,
	"destination" text,
	"roadmap_code" text,
	"module_id" uuid,
	"dependencies" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'propuesta' NOT NULL,
	"verdict" text,
	"verdict_note" text,
	"asana_task_gid" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_meeting_minutes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meeting_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"attendees" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"agreements" text[] DEFAULT '{}' NOT NULL,
	"pending_decisions" text[] DEFAULT '{}' NOT NULL,
	"confirmed_no_dev" text[] DEFAULT '{}' NOT NULL,
	"quoted_figures" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text,
	"gmail_draft_id" text,
	"drive_doc_id" text,
	"status" text DEFAULT 'borrador' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"meeting_id" uuid,
	"question" text NOT NULL,
	"for_whom" text,
	"since" date NOT NULL,
	"blocks" text,
	"status" text DEFAULT 'abierta' NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"source" text DEFAULT 'reunion' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "dev_backlog" ADD CONSTRAINT "dev_backlog_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_backlog" ADD CONSTRAINT "dev_backlog_meeting_id_dev_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."dev_meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_backlog" ADD CONSTRAINT "dev_backlog_module_id_dev_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."dev_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_meeting_minutes" ADD CONSTRAINT "dev_meeting_minutes_meeting_id_dev_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."dev_meetings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_meeting_minutes" ADD CONSTRAINT "dev_meeting_minutes_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_questions" ADD CONSTRAINT "dev_questions_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_questions" ADD CONSTRAINT "dev_questions_meeting_id_dev_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."dev_meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dev_backlog_program_status_idx" ON "dev_backlog" USING btree ("program_id","status");--> statement-breakpoint
CREATE INDEX "dev_backlog_meeting_idx" ON "dev_backlog" USING btree ("meeting_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_meeting_minutes_meeting_uq" ON "dev_meeting_minutes" USING btree ("meeting_id");--> statement-breakpoint
CREATE INDEX "dev_questions_program_status_idx" ON "dev_questions" USING btree ("program_id","status");