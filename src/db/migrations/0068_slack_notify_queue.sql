ALTER TABLE "slack_notify_log" ADD COLUMN "deliver_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "slack_notify_log" ADD COLUMN "payload" jsonb;