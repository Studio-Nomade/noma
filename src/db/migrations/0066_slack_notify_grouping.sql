ALTER TABLE "slack_notify_log" ADD COLUMN "asana_task_gid" text;--> statement-breakpoint
ALTER TABLE "slack_notify_log" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "slack_notify_log" ADD COLUMN "body" text;--> statement-breakpoint
CREATE INDEX "slack_notify_log_task_idx" ON "slack_notify_log" USING btree ("asana_task_gid","created_at");