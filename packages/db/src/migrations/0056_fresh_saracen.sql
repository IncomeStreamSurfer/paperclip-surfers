-- Drop any partial state from a previous failed run
DROP TABLE IF EXISTS "social_posts";--> statement-breakpoint
DROP TABLE IF EXISTS "social_accounts";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_post_status";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_platform";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."social_account_status";--> statement-breakpoint
CREATE TYPE "public"."social_account_status" AS ENUM('active', 'disconnected', 'error');--> statement-breakpoint
CREATE TYPE "public"."social_platform" AS ENUM('twitter', 'linkedin', 'instagram', 'tiktok', 'facebook', 'youtube', 'pinterest', 'threads');--> statement-breakpoint
CREATE TYPE "public"."social_post_status" AS ENUM('draft', 'proposed', 'approved', 'scheduled', 'published', 'rejected');--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"platform" "social_platform" NOT NULL,
	"handle" text NOT NULL,
	"display_name" text,
	"profile_image_url" text,
	"access_token_enc" text,
	"status" "social_account_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"account_id" text,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"status" "social_post_status" DEFAULT 'draft' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"data" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_account_id_social_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_accounts"("id") ON DELETE set null ON UPDATE no action;
