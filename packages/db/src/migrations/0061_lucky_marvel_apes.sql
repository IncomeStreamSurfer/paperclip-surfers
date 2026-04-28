CREATE TABLE "design_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"expanded_prompt" text,
	"style" text DEFAULT 'realistic' NOT NULL,
	"checkpoint_used" text,
	"asset_id" uuid,
	"image_url" text,
	"width" integer DEFAULT 512 NOT NULL,
	"height" integer DEFAULT 512 NOT NULL,
	"steps" integer DEFAULT 20 NOT NULL,
	"cfg" real DEFAULT 7 NOT NULL,
	"seed" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_assets" ADD CONSTRAINT "design_assets_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE set null ON UPDATE no action;