CREATE TYPE "public"."survey_assignment_status" AS ENUM('pendiente', 'respondida');--> statement-breakpoint
CREATE TYPE "public"."survey_question_type" AS ENUM('escala_1_5', 'nps', 'opcion_multiple', 'texto_libre', 'si_no');--> statement-breakpoint
CREATE TYPE "public"."survey_status" AS ENUM('borrador', 'activa', 'cerrada');--> statement-breakpoint
CREATE TYPE "public"."survey_type" AS ENUM('clima', 'desempeno');--> statement-breakpoint
CREATE TABLE "survey_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"response_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"value_number" numeric(8, 2),
	"value_text" text,
	"value_option" text
);
--> statement-breakpoint
CREATE TABLE "survey_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"team_member_id" uuid NOT NULL,
	"status" "survey_assignment_status" DEFAULT 'pendiente' NOT NULL,
	"invited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "survey_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"type" "survey_question_type" NOT NULL,
	"label" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survey_id" uuid NOT NULL,
	"respondent_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "survey_type" NOT NULL,
	"is_anonymous" boolean NOT NULL,
	"status" "survey_status" DEFAULT 'borrador' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_by" uuid,
	"min_responses_to_reveal" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_response_id_survey_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."survey_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_answers" ADD CONSTRAINT "survey_answers_question_id_survey_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."survey_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_assignments" ADD CONSTRAINT "survey_assignments_team_member_id_team_members_id_fk" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_questions" ADD CONSTRAINT "survey_questions_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_survey_id_surveys_id_fk" FOREIGN KEY ("survey_id") REFERENCES "public"."surveys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "survey_responses" ADD CONSTRAINT "survey_responses_respondent_id_team_members_id_fk" FOREIGN KEY ("respondent_id") REFERENCES "public"."team_members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "survey_answers_response_idx" ON "survey_answers" USING btree ("response_id");--> statement-breakpoint
CREATE UNIQUE INDEX "survey_assignments_survey_member_unique" ON "survey_assignments" USING btree ("survey_id","team_member_id");--> statement-breakpoint
CREATE INDEX "survey_questions_survey_idx" ON "survey_questions" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_idx" ON "survey_responses" USING btree ("survey_id");--> statement-breakpoint
CREATE INDEX "surveys_status_idx" ON "surveys" USING btree ("status");
--> statement-breakpoint
CREATE FUNCTION "prevent_survey_anonymity_change"() RETURNS trigger AS $$
BEGIN
  IF NEW.is_anonymous IS DISTINCT FROM OLD.is_anonymous THEN
    RAISE EXCEPTION 'survey anonymity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "surveys_anonymity_immutable"
BEFORE UPDATE ON "surveys"
FOR EACH ROW EXECUTE FUNCTION "prevent_survey_anonymity_change"();
--> statement-breakpoint
CREATE FUNCTION "protect_anonymous_survey_response"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM surveys WHERE id = NEW.survey_id AND is_anonymous = true) THEN
    NEW.respondent_id := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "survey_responses_protect_anonymity"
BEFORE INSERT OR UPDATE ON "survey_responses"
FOR EACH ROW EXECUTE FUNCTION "protect_anonymous_survey_response"();
--> statement-breakpoint
CREATE FUNCTION "protect_anonymous_assignment_timestamp"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM surveys WHERE id = NEW.survey_id AND is_anonymous = true) THEN
    NEW.responded_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "survey_assignments_protect_anonymity"
BEFORE INSERT OR UPDATE ON "survey_assignments"
FOR EACH ROW EXECUTE FUNCTION "protect_anonymous_assignment_timestamp"();
