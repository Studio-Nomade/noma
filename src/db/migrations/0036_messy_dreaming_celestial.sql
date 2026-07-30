ALTER TABLE "client_requests" ADD COLUMN "source_message_id" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "asana_attempted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "client_requests_source_message_unique" ON "client_requests" USING btree ("source_message_id") WHERE "client_requests"."source_message_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "client_requests_idempotency_unique" ON "client_requests" USING btree ("idempotency_key") WHERE "client_requests"."idempotency_key" is not null;