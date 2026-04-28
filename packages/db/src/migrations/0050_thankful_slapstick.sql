CREATE TABLE "company_allowed_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"model_id" text NOT NULL,
	"provider" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"allowed_by_user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "company_allowed_models" ADD CONSTRAINT "company_allowed_models_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_allowed_models_company_model_uniq" ON "company_allowed_models" USING btree ("company_id","model_id");--> statement-breakpoint
CREATE INDEX "company_allowed_models_company_id_idx" ON "company_allowed_models" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "company_allowed_models_provider_idx" ON "company_allowed_models" USING btree ("provider");