CREATE TABLE "bot_authorized_senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_channel_id" uuid NOT NULL,
	"client_contact_id" uuid,
	"display_name" text NOT NULL,
	"phone" text NOT NULL,
	"profile" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bot_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"asana_project_gid" text,
	"status" text DEFAULT 'active' NOT NULL,
	"context_pack" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bot_channel_id" uuid NOT NULL,
	"sender_id" uuid,
	"phone" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"last_inbound_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "bot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"wa_message_id" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"bot_channel_id" uuid,
	"sender_id" uuid,
	"channel" text DEFAULT 'whatsapp' NOT NULL,
	"raw_text" text NOT NULL,
	"normalized_summary" text,
	"scope_class" text DEFAULT 'unknown' NOT NULL,
	"asana_task_gid" text,
	"asana_url" text,
	"status" text DEFAULT 'captured' NOT NULL,
	"created_via" text DEFAULT 'bot' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "whatsapp_inbound_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wa_message_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "whatsapp_inbound_events_wa_message_id_unique" UNIQUE("wa_message_id")
);
--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "asana_project_gid" text;--> statement-breakpoint
ALTER TABLE "bot_authorized_senders" ADD CONSTRAINT "bot_authorized_senders_bot_channel_id_bot_channels_id_fk" FOREIGN KEY ("bot_channel_id") REFERENCES "public"."bot_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_authorized_senders" ADD CONSTRAINT "bot_authorized_senders_client_contact_id_client_contacts_id_fk" FOREIGN KEY ("client_contact_id") REFERENCES "public"."client_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_channels" ADD CONSTRAINT "bot_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_channels" ADD CONSTRAINT "bot_channels_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_conversations" ADD CONSTRAINT "bot_conversations_bot_channel_id_bot_channels_id_fk" FOREIGN KEY ("bot_channel_id") REFERENCES "public"."bot_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_conversations" ADD CONSTRAINT "bot_conversations_sender_id_bot_authorized_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."bot_authorized_senders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_conversation_id_bot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."bot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_bot_channel_id_bot_channels_id_fk" FOREIGN KEY ("bot_channel_id") REFERENCES "public"."bot_channels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_requests" ADD CONSTRAINT "client_requests_sender_id_bot_authorized_senders_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."bot_authorized_senders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bot_authorized_senders_active_phone_unique" ON "bot_authorized_senders" USING btree ("phone") WHERE "bot_authorized_senders"."status" = 'active';--> statement-breakpoint
CREATE INDEX "bot_authorized_senders_channel_idx" ON "bot_authorized_senders" USING btree ("bot_channel_id");--> statement-breakpoint
CREATE INDEX "bot_authorized_senders_contact_idx" ON "bot_authorized_senders" USING btree ("client_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_channels_project_unique" ON "bot_channels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "bot_channels_client_idx" ON "bot_channels" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "bot_channels_status_idx" ON "bot_channels" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bot_conversations_channel_idx" ON "bot_conversations" USING btree ("bot_channel_id");--> statement-breakpoint
CREATE INDEX "bot_conversations_phone_status_idx" ON "bot_conversations" USING btree ("phone","status");--> statement-breakpoint
CREATE INDEX "bot_messages_conversation_created_idx" ON "bot_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bot_messages_wa_message_unique" ON "bot_messages" USING btree ("wa_message_id") WHERE "bot_messages"."wa_message_id" is not null;--> statement-breakpoint
CREATE INDEX "client_requests_client_created_idx" ON "client_requests" USING btree ("client_id","created_at");--> statement-breakpoint
CREATE INDEX "client_requests_project_created_idx" ON "client_requests" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "client_requests_status_idx" ON "client_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "whatsapp_inbound_events_status_idx" ON "whatsapp_inbound_events" USING btree ("status","created_at");