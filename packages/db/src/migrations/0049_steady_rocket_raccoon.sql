CREATE TABLE "agent_departments" (
	"agent_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	CONSTRAINT "agent_departments_pk" PRIMARY KEY("agent_id","department_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"lead_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_memories" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD COLUMN "shared_with" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD COLUMN "shared_with" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "company_skills" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "company_skills" ADD COLUMN "shared_with" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "shared_with" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_departments" ADD CONSTRAINT "agent_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_departments_dept_idx" ON "agent_departments" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "agent_departments_agent_idx" ON "agent_departments" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "departments_company_name_idx" ON "departments" USING btree ("company_id","name");--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_policies" ADD CONSTRAINT "budget_policies_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_skills" ADD CONSTRAINT "company_skills_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_memories_dept_idx" ON "agent_memories" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "budget_policies_dept_idx" ON "budget_policies" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "company_skills_dept_idx" ON "company_skills" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "routines_department_idx" ON "routines" USING btree ("department_id");