ALTER TABLE "client_requests" ADD COLUMN "email_pending_adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "request_deliveries" ADD COLUMN "kind" text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "request_deliveries" ADD COLUMN "files" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "request_deliveries" ADD COLUMN "applied_adjustments" jsonb DEFAULT '[]'::jsonb NOT NULL;