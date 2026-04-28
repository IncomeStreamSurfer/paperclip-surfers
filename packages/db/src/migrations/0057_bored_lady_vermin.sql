CREATE TYPE "public"."seo_page_status" AS ENUM('draft', 'published', 'needs-work');--> statement-breakpoint
CREATE TABLE "seo_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"target_url" text,
	"search_volume" integer,
	"difficulty" integer,
	"current_rank" integer,
	"target_rank" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seo_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"meta_description" text,
	"h1" text,
	"focus_keyword" text,
	"seo_score" integer,
	"status" "seo_page_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "social_accounts" ALTER COLUMN "company_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "social_posts" ALTER COLUMN "company_id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "seo_keywords" ADD CONSTRAINT "seo_keywords_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_pages" ADD CONSTRAINT "seo_pages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;