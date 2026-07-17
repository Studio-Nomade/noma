CREATE TYPE "public"."contact_profile" AS ENUM('administrativo', 'comercial', 'facturacion');--> statement-breakpoint
ALTER TABLE "client_contacts" ADD COLUMN "profiles" "contact_profile"[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "comuna" text;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "region" text;