CREATE TABLE "civil_drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"drawing_number" text,
	"drawing_type" text DEFAULT 'plan' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" text DEFAULT 'A' NOT NULL,
	"discipline" text,
	"scale" text,
	"file_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civil_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"project_type" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"location" text,
	"client_name" text,
	"estimated_budget" text,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "civil_specifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"title" text NOT NULL,
	"section_number" text,
	"content" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"goal" text,
	"status" text DEFAULT 'planning' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"ai_report" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm_deals" ALTER COLUMN "contact_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "sprint_id" uuid;--> statement-breakpoint
ALTER TABLE "civil_drawings" ADD CONSTRAINT "civil_drawings_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_drawings" ADD CONSTRAINT "civil_drawings_project_id_civil_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."civil_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_projects" ADD CONSTRAINT "civil_projects_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_specifications" ADD CONSTRAINT "civil_specifications_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "civil_specifications" ADD CONSTRAINT "civil_specifications_project_id_civil_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."civil_projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "civil_drawings_company_idx" ON "civil_drawings" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "civil_drawings_project_idx" ON "civil_drawings" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "civil_projects_company_idx" ON "civil_projects" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "civil_specs_company_idx" ON "civil_specifications" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "civil_specs_project_idx" ON "civil_specifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sprints_company_idx" ON "sprints" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "sprints_project_idx" ON "sprints" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_sprint_id_sprints_id_fk" FOREIGN KEY ("sprint_id") REFERENCES "public"."sprints"("id") ON DELETE set null ON UPDATE no action;