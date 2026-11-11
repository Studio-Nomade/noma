ALTER TABLE "email_channels" ADD COLUMN "brief_guide" text;--> statement-breakpoint
ALTER TABLE "email_channels" ADD COLUMN "ai_fields" text[] DEFAULT '{}'::text[] NOT NULL;