CREATE TABLE "model_pricing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"model_name" text,
	"input_price_cents_per_1m" integer DEFAULT 0 NOT NULL,
	"output_price_cents_per_1m" integer DEFAULT 0 NOT NULL,
	"cached_input_price_cents_per_1m" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"context_window" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"effective_from" timestamp with time zone DEFAULT now() NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "model_pricing_provider_model_idx" ON "model_pricing" USING btree ("provider","model_id");--> statement-breakpoint
CREATE INDEX "model_pricing_active_idx" ON "model_pricing" USING btree ("is_active");