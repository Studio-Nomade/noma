CREATE TABLE "proposal_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"root_id" uuid NOT NULL,
	"author_id" uuid,
	"author_email" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "proposals" ADD COLUMN "root_id" uuid;--> statement-breakpoint
CREATE INDEX "proposal_notes_root_idx" ON "proposal_notes" USING btree ("root_id");