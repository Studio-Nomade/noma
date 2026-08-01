CREATE TABLE "email_studio_ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"model" text NOT NULL,
	"asset_count" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"total_tokens" integer,
	"duration_ms" integer,
	"response_id" text,
	"failure_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_studio_ai_runs_status_check" CHECK ("email_studio_ai_runs"."status" in ('running', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "email_studio_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"document_version" integer NOT NULL,
	"generation_mode" text,
	"editor_state" jsonb NOT NULL,
	"document" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_studio_revisions_kind_check" CHECK ("email_studio_revisions"."kind" in ('checkpoint', 'generated', 'restored'))
);
--> statement-breakpoint
ALTER TABLE "email_studio_assets" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_ai_runs" ADD CONSTRAINT "email_studio_ai_runs_project_id_email_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."email_studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_revisions" ADD CONSTRAINT "email_studio_revisions_project_id_email_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."email_studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_studio_ai_runs_project_idx" ON "email_studio_ai_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "email_studio_ai_runs_actor_idx" ON "email_studio_ai_runs" USING btree ("created_by","created_at");--> statement-breakpoint
CREATE INDEX "email_studio_revisions_project_idx" ON "email_studio_revisions" USING btree ("project_id","created_at");--> statement-breakpoint
ALTER TABLE "email_studio_assets" ADD CONSTRAINT "email_studio_assets_status_check" CHECK ("email_studio_assets"."status" in ('active', 'archived'));