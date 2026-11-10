ALTER TABLE "email_channels" ADD COLUMN "ignored_senders" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "email_channels" ADD COLUMN "slack_webhook_env" text;