CREATE TABLE "asana_webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asana_project_gid" text NOT NULL,
	"webhook_gid" text,
	"secret" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "asana_webhooks_asana_project_gid_unique" UNIQUE("asana_project_gid")
);
--> statement-breakpoint
CREATE TABLE "email_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"asana_project_gid" text NOT NULL,
	"section_strategy" text DEFAULT 'month' NOT NULL,
	"fixed_section_gid" text,
	"month_section_template" text DEFAULT '{Mes} | {YYYY}' NOT NULL,
	"default_assignee_gid" text,
	"folio_prefix" text NOT NULL,
	"allowed_sender_domains" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_channels_alias_unique" UNIQUE("alias"),
	CONSTRAINT "email_channels_folio_prefix_unique" UNIQUE("folio_prefix"),
	CONSTRAINT "email_channels_alias_lowercase" CHECK ("email_channels"."alias" = lower("email_channels"."alias")),
	CONSTRAINT "email_channels_section_strategy_check" CHECK ("email_channels"."section_strategy" in ('month', 'fixed')),
	CONSTRAINT "email_channels_fixed_section_check" CHECK ("email_channels"."section_strategy" <> 'fixed' or "email_channels"."fixed_section_gid" is not null)
);
--> statement-breakpoint
CREATE TABLE "email_inbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_history_id" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_inbound_events_gmail_message_id_unique" UNIQUE("gmail_message_id")
);
--> statement-breakpoint
CREATE TABLE "email_mailbox_state" (
	"mailbox" text PRIMARY KEY NOT NULL,
	"history_id" text,
	"watch_expires_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "folio_counters" (
	"prefix" text PRIMARY KEY NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "request_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_request_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"asana_story_gid" text NOT NULL,
	"links" text[] DEFAULT '{}'::text[] NOT NULL,
	"note" text,
	"status" text DEFAULT 'sending' NOT NULL,
	"error" text,
	"sent_gmail_message_id" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "request_deliveries_asana_story_gid_unique" UNIQUE("asana_story_gid")
);
--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "email_channel_id" uuid;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "email_thread_id" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "email_message_id" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "email_last_message_id" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "email_subject" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "email_acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "requester_email" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "requester_name" text;--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "cc_emails" text[];--> statement-breakpoint
ALTER TABLE "client_requests" ADD COLUMN "folio" text;--> statement-breakpoint
ALTER TABLE "email_channels" ADD CONSTRAINT "email_channels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_channels" ADD CONSTRAINT "email_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_deliveries" ADD CONSTRAINT "request_deliveries_client_request_id_client_requests_id_fk" FOREIGN KEY ("client_request_id") REFERENCES "public"."client_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_channels_client_idx" ON "email_channels" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "email_channels_status_idx" ON "email_channels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_inbound_events_status_idx" ON "email_inbound_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "request_deliveries_request_idx" ON "request_deliveries" USING btree ("client_request_id","round");--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_email_channel_id_email_channels_id_fk" FOREIGN KEY ("email_channel_id") REFERENCES "public"."email_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_requests_folio_unique" ON "client_requests" USING btree ("folio") WHERE "client_requests"."folio" is not null;--> statement-breakpoint
CREATE INDEX "client_requests_email_thread_idx" ON "client_requests" USING btree ("email_thread_id");--> statement-breakpoint
CREATE INDEX "client_requests_asana_task_idx" ON "client_requests" USING btree ("asana_task_gid");