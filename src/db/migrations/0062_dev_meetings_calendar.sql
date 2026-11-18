ALTER TABLE "dev_meetings" ADD COLUMN "source" text DEFAULT 'noma' NOT NULL;--> statement-breakpoint
ALTER TABLE "dev_programs" ADD COLUMN "calendar_title_prefix" text;--> statement-breakpoint
CREATE UNIQUE INDEX "dev_meetings_program_event_uq" ON "dev_meetings" USING btree ("program_id","calendar_event_id");