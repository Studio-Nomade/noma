CREATE TABLE "client_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"role" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"area" "area",
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "user_integrations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"email" text,
	"google_refresh_token" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "client_contacts_client_idx" ON "client_contacts" USING btree ("client_id");