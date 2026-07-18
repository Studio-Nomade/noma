ALTER TABLE "clients" ADD COLUMN "portal_token" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "portal_token_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_portal_token_unique" UNIQUE("portal_token");