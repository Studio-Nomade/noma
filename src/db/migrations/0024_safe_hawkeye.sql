CREATE TYPE "public"."course_enrollment_status" AS ENUM('asignado', 'en_curso', 'completado');--> statement-breakpoint
CREATE TYPE "public"."course_level" AS ENUM('inicial', 'intermedio', 'avanzado');--> statement-breakpoint
CREATE TYPE "public"."course_provider" AS ENUM('domestika', 'otro');--> statement-breakpoint
CREATE TABLE "course_enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"team_member_id" uuid NOT NULL,
	"status" "course_enrollment_status" DEFAULT 'asignado' NOT NULL,
	"assigned_by" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"certificate_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"provider" "course_provider" DEFAULT 'domestika' NOT NULL,
	"url" text NOT NULL,
	"area" "area",
	"level" "course_level" DEFAULT 'inicial' NOT NULL,
	"duration_min" integer,
	"description" text,
	"thumbnail_url" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_enrollments" ADD CONSTRAINT "course_enrollments_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "course_enrollments_course_member_unique" ON "course_enrollments" USING btree ("course_id","team_member_id");--> statement-breakpoint
CREATE INDEX "course_enrollments_member_idx" ON "course_enrollments" USING btree ("team_member_id");--> statement-breakpoint
CREATE INDEX "courses_active_idx" ON "courses" USING btree ("active");