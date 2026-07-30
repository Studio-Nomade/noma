ALTER TABLE "client_requests" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
CREATE INDEX "client_requests_conversation_idx" ON "client_requests" USING btree ("conversation_id");