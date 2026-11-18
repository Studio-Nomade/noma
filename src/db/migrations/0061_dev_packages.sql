CREATE TABLE "dev_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"code" text NOT NULL,
	"meeting_id" uuid,
	"origin" text DEFAULT 'reunion' NOT NULL,
	"title" text NOT NULL,
	"item_ids" uuid[] DEFAULT '{}' NOT NULL,
	"yaml" text NOT NULL,
	"status" text DEFAULT 'armado' NOT NULL,
	"delivered_at" timestamp with time zone,
	"result" jsonb,
	"result_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "dev_packages" ADD CONSTRAINT "dev_packages_program_id_dev_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."dev_programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_packages" ADD CONSTRAINT "dev_packages_meeting_id_dev_meetings_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."dev_meetings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dev_packages_program_code_uq" ON "dev_packages" USING btree ("program_id","code");