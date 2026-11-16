CREATE TABLE "assistant_briefings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"data" jsonb NOT NULL,
	"model" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "assistant_briefings_user_day_idx" ON "assistant_briefings" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "assistant_briefings_expires_idx" ON "assistant_briefings" USING btree ("expires_at");