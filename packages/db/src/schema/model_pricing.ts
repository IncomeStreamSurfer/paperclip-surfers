import { pgTable, uuid, text, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";

export const modelPricing = pgTable(
  "model_pricing",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(), // 'ollama', 'openai', 'openrouter', 'vllm', 'azure', 'vercel', 'gemini'
    modelId: text("model_id").notNull(), // provider-specific model identifier
    modelName: text("model_name"), // human-readable display name
    inputPriceCentsPer1M: integer("input_price_cents_per_1m").notNull().default(0), // price per 1M input tokens
    outputPriceCentsPer1M: integer("output_price_cents_per_1m").notNull().default(0), // price per 1M output tokens
    cachedInputPriceCentsPer1M: integer("cached_input_price_cents_per_1m").notNull().default(0), // price per 1M cached input tokens
    currency: text("currency").notNull().default("USD"),
    contextWindow: integer("context_window"), // max context window in tokens
    isActive: boolean("is_active").notNull().default(true),
    source: text("source").notNull().default("manual"), // 'manual', 'seed', 'api_sync'
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull().defaultNow(),
    effectiveTo: timestamp("effective_to", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    providerModelIdx: index("model_pricing_provider_model_idx").on(table.provider, table.modelId),
    activeIdx: index("model_pricing_active_idx").on(table.isActive),
  }),
);
