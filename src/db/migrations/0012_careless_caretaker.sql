CREATE TYPE "public"."note_source" AS ENUM('drive', 'paste', 'file', 'link');--> statement-breakpoint
CREATE TABLE "brief_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"meeting_id" uuid,
	"source" "note_source" NOT NULL,
	"drive_file_id" text,
	"drive_url" text,
	"file_name" text,
	"raw_text" text,
	"match_status" text,
	"match_candidates" jsonb DEFAULT '[]'::jsonb,
	"imported_by" uuid,
	"imported_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "brief_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brief_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"snapshot" jsonb DEFAULT '{}'::jsonb,
	"ai_extraction" jsonb,
	"is_approved" boolean DEFAULT false NOT NULL,
	"approved_by" uuid,
	"approved_by_email" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "briefs" ALTER COLUMN "status" SET DEFAULT 'Sin reunión agendada';--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "context_general" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "budget_mentioned" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "decision_makers" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "urgency" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "restrictions" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "pending_info" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "recommended_next_action" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "commercial_recs" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "risks" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "next_steps" text;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "area_blocks" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "involved_areas" "area"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "ai_extraction" jsonb;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "approved_version_id" uuid;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "approved_by" uuid;--> statement-breakpoint
ALTER TABLE "briefs" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brief_notes" ADD CONSTRAINT "brief_notes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_notes" ADD CONSTRAINT "brief_notes_meeting_id_brief_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."brief_meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_versions" ADD CONSTRAINT "brief_versions_brief_id_briefs_id_fk" FOREIGN KEY ("brief_id") REFERENCES "public"."briefs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_versions" ADD CONSTRAINT "brief_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brief_notes_project_idx" ON "brief_notes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "brief_versions_brief_idx" ON "brief_versions" USING btree ("brief_id");