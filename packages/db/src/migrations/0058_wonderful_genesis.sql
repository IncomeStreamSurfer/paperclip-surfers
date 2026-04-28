CREATE TABLE "copywriting_briefs" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"content_type" text DEFAULT 'blog-post' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"target_keyword" text,
	"target_audience" text,
	"word_count_target" integer,
	"due_date" timestamp with time zone,
	"assigned_agent_id" uuid,
	"brief" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" text;--> statement-breakpoint
ALTER TABLE "copywriting_briefs" ADD CONSTRAINT "copywriting_briefs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copywriting_briefs" ADD CONSTRAINT "copywriting_briefs_assigned_agent_id_agents_id_fk" FOREIGN KEY ("assigned_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;