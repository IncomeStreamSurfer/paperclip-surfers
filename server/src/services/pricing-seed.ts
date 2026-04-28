import type { Db } from "@paperclipai/db";
import { modelPricing } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../middleware/logger.js";

const DEFAULT_PRICING_SEED = [
  // OpenAI
  {
    provider: "openai",
    modelId: "gpt-4o",
    modelName: "GPT-4o",
    inputPriceCentsPer1M: 250,
    outputPriceCentsPer1M: 1000,
    cachedInputPriceCentsPer1M: 125,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "openai",
    modelId: "gpt-4o-mini",
    modelName: "GPT-4o Mini",
    inputPriceCentsPer1M: 15,
    outputPriceCentsPer1M: 60,
    cachedInputPriceCentsPer1M: 7,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "openai",
    modelId: "gpt-4-turbo",
    modelName: "GPT-4 Turbo",
    inputPriceCentsPer1M: 1000,
    outputPriceCentsPer1M: 3000,
    cachedInputPriceCentsPer1M: 500,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "openai",
    modelId: "gpt-3.5-turbo",
    modelName: "GPT-3.5 Turbo",
    inputPriceCentsPer1M: 50,
    outputPriceCentsPer1M: 150,
    cachedInputPriceCentsPer1M: 25,
    currency: "USD",
    contextWindow: 16_385,
  },
  {
    provider: "openai",
    modelId: "o1-preview",
    modelName: "o1 Preview",
    inputPriceCentsPer1M: 1500,
    outputPriceCentsPer1M: 6000,
    cachedInputPriceCentsPer1M: 750,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "openai",
    modelId: "o1-mini",
    modelName: "o1 Mini",
    inputPriceCentsPer1M: 300,
    outputPriceCentsPer1M: 1200,
    cachedInputPriceCentsPer1M: 150,
    currency: "USD",
    contextWindow: 128_000,
  },
  // OpenRouter (approximate averages — these fluctuate by provider)
  {
    provider: "openrouter",
    modelId: "openai/gpt-4o",
    modelName: "GPT-4o (OpenRouter)",
    inputPriceCentsPer1M: 250,
    outputPriceCentsPer1M: 1000,
    cachedInputPriceCentsPer1M: 125,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "openrouter",
    modelId: "anthropic/claude-3.5-sonnet",
    modelName: "Claude 3.5 Sonnet (OpenRouter)",
    inputPriceCentsPer1M: 300,
    outputPriceCentsPer1M: 1500,
    cachedInputPriceCentsPer1M: 150,
    currency: "USD",
    contextWindow: 200_000,
  },
  {
    provider: "openrouter",
    modelId: "anthropic/claude-3.5-haiku",
    modelName: "Claude 3.5 Haiku (OpenRouter)",
    inputPriceCentsPer1M: 80,
    outputPriceCentsPer1M: 400,
    cachedInputPriceCentsPer1M: 40,
    currency: "USD",
    contextWindow: 200_000,
  },
  {
    provider: "openrouter",
    modelId: "google/gemini-1.5-pro",
    modelName: "Gemini 1.5 Pro (OpenRouter)",
    inputPriceCentsPer1M: 125,
    outputPriceCentsPer1M: 500,
    cachedInputPriceCentsPer1M: 62,
    currency: "USD",
    contextWindow: 2_000_000,
  },
  {
    provider: "openrouter",
    modelId: "meta-llama/llama-3.3-70b-instruct",
    modelName: "Llama 3.3 70B (OpenRouter)",
    inputPriceCentsPer1M: 120,
    outputPriceCentsPer1M: 300,
    cachedInputPriceCentsPer1M: 60,
    currency: "USD",
    contextWindow: 128_000,
  },
  // Ollama (local — zero marginal cost; seeded at 0 so cost tracking shows usage without billing)
  {
    provider: "ollama",
    modelId: "dagbs/deepseek-coder-v2-lite-instruct:latest",
    modelName: "DeepSeek Coder V2 Lite (Ollama)",
    inputPriceCentsPer1M: 0,
    outputPriceCentsPer1M: 0,
    cachedInputPriceCentsPer1M: 0,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "ollama",
    modelId: "nomic-embed-text:latest",
    modelName: "Nomic Embed Text (Ollama)",
    inputPriceCentsPer1M: 0,
    outputPriceCentsPer1M: 0,
    cachedInputPriceCentsPer1M: 0,
    currency: "USD",
    contextWindow: 8_192,
  },
  {
    provider: "ollama",
    modelId: "llama3.3:latest",
    modelName: "Llama 3.3 (Ollama)",
    inputPriceCentsPer1M: 0,
    outputPriceCentsPer1M: 0,
    cachedInputPriceCentsPer1M: 0,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "ollama",
    modelId: "qwen2.5-coder:latest",
    modelName: "Qwen 2.5 Coder (Ollama)",
    inputPriceCentsPer1M: 0,
    outputPriceCentsPer1M: 0,
    cachedInputPriceCentsPer1M: 0,
    currency: "USD",
    contextWindow: 128_000,
  },
  // Azure OpenAI
  {
    provider: "azure_openai",
    modelId: "gpt-4o",
    modelName: "GPT-4o (Azure)",
    inputPriceCentsPer1M: 250,
    outputPriceCentsPer1M: 1000,
    cachedInputPriceCentsPer1M: 125,
    currency: "USD",
    contextWindow: 128_000,
  },
  {
    provider: "azure_openai",
    modelId: "gpt-4o-mini",
    modelName: "GPT-4o Mini (Azure)",
    inputPriceCentsPer1M: 15,
    outputPriceCentsPer1M: 60,
    cachedInputPriceCentsPer1M: 7,
    currency: "USD",
    contextWindow: 128_000,
  },
  // Gemini
  {
    provider: "gemini",
    modelId: "gemini-1.5-pro",
    modelName: "Gemini 1.5 Pro",
    inputPriceCentsPer1M: 125,
    outputPriceCentsPer1M: 500,
    cachedInputPriceCentsPer1M: 62,
    currency: "USD",
    contextWindow: 2_000_000,
  },
  {
    provider: "gemini",
    modelId: "gemini-1.5-flash",
    modelName: "Gemini 1.5 Flash",
    inputPriceCentsPer1M: 37,
    outputPriceCentsPer1M: 150,
    cachedInputPriceCentsPer1M: 18,
    currency: "USD",
    contextWindow: 1_000_000,
  },
];

export async function seedModelPricing(db: Db) {
  const log = logger.child({ service: "pricing-seed" });
  let created = 0;
  let skipped = 0;

  for (const entry of DEFAULT_PRICING_SEED) {
    const existing = await db
      .select({ id: modelPricing.id })
      .from(modelPricing)
      .where(
        and(
          eq(modelPricing.provider, entry.provider),
          eq(modelPricing.modelId, entry.modelId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(modelPricing).values({
      provider: entry.provider,
      modelId: entry.modelId,
      modelName: entry.modelName,
      inputPriceCentsPer1M: entry.inputPriceCentsPer1M,
      outputPriceCentsPer1M: entry.outputPriceCentsPer1M,
      cachedInputPriceCentsPer1M: entry.cachedInputPriceCentsPer1M,
      currency: entry.currency,
      contextWindow: entry.contextWindow,
      isActive: true,
      effectiveFrom: new Date(),
      source: "seed",
    });
    created++;
  }

  if (created > 0) {
    log.info({ created, skipped }, "Seeded model pricing entries");
  } else {
    log.debug({ skipped }, "Model pricing seed: all entries already present");
  }
}
