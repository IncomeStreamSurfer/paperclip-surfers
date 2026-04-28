CREATE TABLE "user_company_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"company_id" uuid NOT NULL,
	"role" text NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"invited_by_user_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_company_roles" ADD CONSTRAINT "user_company_roles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_company_roles_user_company_uniq" ON "user_company_roles" USING btree ("user_id","company_id");--> statement-breakpoint
CREATE INDEX "user_company_roles_company_idx" ON "user_company_roles" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "user_company_roles_user_idx" ON "user_company_roles" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_invitations_token_uniq" ON "user_invitations" USING btree ("token");--> statement-breakpoint
CREATE INDEX "user_invitations_company_email_idx" ON "user_invitations" USING btree ("company_id","email");--> statement-breakpoint
CREATE INDEX "user_invitations_company_active_idx" ON "user_invitations" USING btree ("company_id","accepted_at","revoked_at");