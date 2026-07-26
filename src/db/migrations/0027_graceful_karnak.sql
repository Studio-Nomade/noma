ALTER TABLE "proposal_team" ALTER COLUMN "member_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "proposal_team" ADD COLUMN "custom_name" text;--> statement-breakpoint
ALTER TABLE "proposal_team" ADD COLUMN "custom_role_title" text;--> statement-breakpoint
ALTER TABLE "proposal_team" ADD COLUMN "custom_photo_url" text;