CREATE TABLE "dev_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"date" date NOT NULL,
	"module_id" uuid,
	"module_code" text,
	"text" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"module_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"date" date,
	"asana_task_gid" text,
	"pr_numbers" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"objective" text,
	"start_date" date,
	"target_date" date,
	"progress" integer DEFAULT 0 NOT NULL,
	"criteria" text,
	"ball_owner" text,
	"ball_what" text,
	"next_follow_up" date,
	"in_production" text[] DEFAULT '{}' NOT NULL,
	"pending" text[] DEFAULT '{}' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"repos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"asana_project_gid" text,
	"portal_visible" boolean DEFAULT false NOT NULL,
	"next_roadmap_number" integer DEFAULT 1 NOT NULL,
	"next_module_number" integer DEFAULT 1 NOT NULL,
	"source_updated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_prs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"repo" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"base_branch" text NOT NULL,
	"head_branch" text,
	"merged_at" timestamp with time zone,
	"month" text NOT NULL,
	"author" text,
	"roadmap_code" text,
	"module_id" uuid,
	"is_promotion" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'import' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dev_roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"month" text NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"kind" text DEFAULT 'mejora' NOT NULL,
	"module_id" uuid,
	"asana_task_gids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "dev_log" ADD CONSTRAINT "dev_log_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_log" ADD CONSTRAINT "dev_log_module_id_dev_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."dev_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_milestones" ADD CONSTRAINT "dev_milestones_module_id_dev_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."dev_modules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_modules" ADD CONSTRAINT "dev_modules_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_programs" ADD CONSTRAINT "dev_programs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_programs" ADD CONSTRAINT "dev_programs_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_prs" ADD CONSTRAINT "dev_prs_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_prs" ADD CONSTRAINT "dev_prs_module_id_dev_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."dev_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_roadmaps" ADD CONSTRAINT "dev_roadmaps_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_roadmaps" ADD CONSTRAINT "dev_roadmaps_module_id_dev_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."dev_modules"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dev_log_program_date_idx" ON "dev_log" USING btree ("program_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_log_program_date_text_uq" ON "dev_log" USING btree ("program_id","date","text");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_milestones_module_name_uq" ON "dev_milestones" USING btree ("module_id","name");--> statement-breakpoint
CREATE INDEX "dev_milestones_status_idx" ON "dev_milestones" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_modules_program_code_uq" ON "dev_modules" USING btree ("program_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_programs_project_uq" ON "dev_programs" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_prs_program_repo_number_uq" ON "dev_prs" USING btree ("program_id","repo","number");--> statement-breakpoint
CREATE INDEX "dev_prs_month_idx" ON "dev_prs" USING btree ("program_id","month");--> statement-breakpoint
CREATE INDEX "dev_prs_roadmap_idx" ON "dev_prs" USING btree ("program_id","roadmap_code");--> statement-breakpoint
CREATE UNIQUE INDEX "dev_roadmaps_program_code_uq" ON "dev_roadmaps" USING btree ("program_id","code");--> statement-breakpoint
CREATE INDEX "dev_roadmaps_month_idx" ON "dev_roadmaps" USING btree ("program_id","month");