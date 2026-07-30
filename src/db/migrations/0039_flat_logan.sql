ALTER TABLE "client_requests" ADD COLUMN "predicted_scope_class" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "scope_corrected_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "client_requests_analytics_idx" ON "client_requests" USING btree ("client_id","created_at","scope_class","status");