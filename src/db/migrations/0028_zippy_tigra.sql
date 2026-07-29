CREATE TABLE "email_signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"area" "area",
	"role" text NOT NULL,
	"sender_name" text NOT NULL,
	"sender_email" text NOT NULL,
	"signature_html" text NOT NULL,
	"signature_text" text NOT NULL,
	"status" text DEFAULT 'Activo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_signatures_key_unique" UNIQUE("key")
);
