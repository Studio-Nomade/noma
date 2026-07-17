CREATE TYPE "public"."meeting_status" AS ENUM('Agendada', 'Realizada', 'Cancelada');--> statement-breakpoint
ALTER TYPE "public"."area" ADD VALUE 'CSM';--> statement-breakpoint
ALTER TYPE "public"."area" ADD VALUE 'STR';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Sin reunión agendada';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Reunión agendada';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Reunión realizada';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Notas pendientes';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Notas importadas';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Procesando notas';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Brief sugerido';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Brief en revisión';--> statement-breakpoint
ALTER TYPE "public"."brief_status" ADD VALUE 'Brief aprobado';--> statement-breakpoint
ALTER TYPE "public"."commercial_stage" ADD VALUE 'Lead calificado';--> statement-breakpoint
ALTER TYPE "public"."commercial_stage" ADD VALUE 'Reunión inicial agendada';--> statement-breakpoint
ALTER TYPE "public"."commercial_stage" ADD VALUE 'Traspasado a operación';--> statement-breakpoint
CREATE TABLE "brief_meetings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid,
	"title" text NOT NULL,
	"objective" text,
	"agenda" text,
	"area" "area",
	"areas" "area"[] DEFAULT '{}' NOT NULL,
	"starts_at" timestamp with time zone,
	"duration_min" integer DEFAULT 45 NOT NULL,
	"responsible_id" uuid,
	"organizer_id" uuid,
	"organizer_email" text,
	"internal_participants" jsonb DEFAULT '[]'::jsonb,
	"external_participants" jsonb DEFAULT '[]'::jsonb,
	"calendar_event_id" text,
	"calendar_link" text,
	"meet_link" text,
	"status" "meeting_status" DEFAULT 'Agendada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "brief_meetings" ADD CONSTRAINT "brief_meetings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_meetings" ADD CONSTRAINT "brief_meetings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brief_meetings" ADD CONSTRAINT "brief_meetings_responsible_id_team_members_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brief_meetings_project_idx" ON "brief_meetings" USING btree ("project_id");