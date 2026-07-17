CREATE TABLE "proposal_team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"role_in_project" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "role_title" text;--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "proposal_team" ADD CONSTRAINT "proposal_team_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_team" ADD CONSTRAINT "proposal_team_member_id_team_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."team_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_team_unique" ON "proposal_team" USING btree ("proposal_id","member_id");