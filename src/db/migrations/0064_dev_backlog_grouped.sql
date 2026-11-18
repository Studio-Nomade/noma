ALTER TABLE "dev_backlog" ADD COLUMN "grouped_at" timestamp with time zone;--> statement-breakpoint
UPDATE "dev_backlog" SET "grouped_at" = "updated_at" WHERE "status" IN ('en_asana', 'verificada');
