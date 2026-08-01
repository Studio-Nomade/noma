CREATE TABLE "email_studio_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"role" text NOT NULL,
	"label" text NOT NULL,
	"original_name" text NOT NULL,
	"storage_path" text NOT NULL,
	"public_url" text,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"optimized" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_studio_assets_role_check" CHECK ("email_studio_assets"."role" in ('reference', 'asset')),
	CONSTRAINT "email_studio_assets_size_check" CHECK ("email_studio_assets"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "email_studio_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"asset_id" uuid,
	"template_id" uuid,
	"label" text NOT NULL,
	"content" text,
	"href" text,
	"alt" text DEFAULT '' NOT NULL,
	"align" text DEFAULT 'center' NOT NULL,
	"font_size" integer DEFAULT 16 NOT NULL,
	"color" text DEFAULT '#333333' NOT NULL,
	"background_color" text DEFAULT '#111111' NOT NULL,
	"padding" text DEFAULT '16px 32px' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_studio_elements_type_check" CHECK ("email_studio_elements"."type" in ('image', 'text', 'button', 'spacer', 'template')),
	CONSTRAINT "email_studio_elements_position_check" CHECK ("email_studio_elements"."position" >= 0),
	CONSTRAINT "email_studio_elements_align_check" CHECK ("email_studio_elements"."align" in ('left', 'center', 'right')),
	CONSTRAINT "email_studio_elements_font_size_check" CHECK ("email_studio_elements"."font_size" between 1 and 72)
);
--> statement-breakpoint
CREATE TABLE "email_studio_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"source_project_id" uuid,
	"asset_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"alt" text DEFAULT '' NOT NULL,
	"href" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "email_studio_templates_status_check" CHECK ("email_studio_templates"."status" in ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "email_studio_variables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"sample" text DEFAULT '' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "subject" text DEFAULT 'Nuevo correo' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "preview_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "email_width" integer DEFAULT 700 NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "canvas_color" text DEFAULT '#f4f4f1' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "body_color" text DEFAULT '#ffffff' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "text_color" text DEFAULT '#333333' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "generation_mode" text;--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD COLUMN "generated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_studio_assets" ADD CONSTRAINT "email_studio_assets_project_id_email_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."email_studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_elements" ADD CONSTRAINT "email_studio_elements_project_id_email_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."email_studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_elements" ADD CONSTRAINT "email_studio_elements_asset_id_email_studio_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."email_studio_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_elements" ADD CONSTRAINT "email_studio_elements_template_id_email_studio_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_studio_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_templates" ADD CONSTRAINT "email_studio_templates_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_templates" ADD CONSTRAINT "email_studio_templates_source_project_id_email_studio_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."email_studio_projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_templates" ADD CONSTRAINT "email_studio_templates_asset_id_email_studio_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."email_studio_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_studio_variables" ADD CONSTRAINT "email_studio_variables_project_id_email_studio_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."email_studio_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_studio_assets_project_idx" ON "email_studio_assets" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "email_studio_elements_project_idx" ON "email_studio_elements" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "email_studio_templates_client_idx" ON "email_studio_templates" USING btree ("client_id","status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_studio_variables_project_key_unique" ON "email_studio_variables" USING btree ("project_id","key");--> statement-breakpoint
ALTER TABLE "email_studio_projects" ADD CONSTRAINT "email_studio_projects_width_check" CHECK ("email_studio_projects"."email_width" between 560 and 720);