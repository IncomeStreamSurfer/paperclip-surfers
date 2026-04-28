import { eq, and, desc, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { modelPricing } from "@paperclipai/db";

export function pricingService(db: Db) {
  return {
    async list(opts?: { provider?: string; isActive?: boolean }) {
      const conditions = [];
      if (opts?.provider) conditions.push(eq(modelPricing.provider, opts.provider));
      if (opts?.isActive !== undefined) conditions.push(eq(modelPricing.isActive, opts.isActive));

      const rows = await db
        .select()
        .from(modelPricing)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(modelPricing.updatedAt));
      return rows;
    },

    async getById(id: string) {
      const [row] = await db.select().from(modelPricing).where(eq(modelPricing.id, id)).limit(1);
      return row ?? null;
    },

    async findByProviderModel(provider: string, modelId: string) {
      const [row] = await db
        .select()
        .from(modelPricing)
        .where(
          and(
            eq(modelPricing.provider, provider),
            eq(modelPricing.modelId, modelId),
            eq(modelPricing.isActive, true),
            sql`${modelPricing.effectiveFrom} <= now()`,
            sql`(${modelPricing.effectiveTo} is null or ${modelPricing.effectiveTo} > now())`,
          ),
        )
        .orderBy(desc(modelPricing.effectiveFrom))
        .limit(1);
      return row ?? null;
    },

    async create(data: {
      provider: string;
      modelId: string;
      modelName?: string | null;
      inputPriceCentsPer1M?: number;
      outputPriceCentsPer1M?: number;
      cachedInputPriceCentsPer1M?: number;
      currency?: string;
      contextWindow?: number | null;
      isActive?: boolean;
      effectiveFrom?: Date;
    }) {
      const [row] = await db
        .insert(modelPricing)
        .values({
          provider: data.provider,
          modelId: data.modelId,
          modelName: data.modelName ?? null,
          inputPriceCentsPer1M: data.inputPriceCentsPer1M ?? 0,
          outputPriceCentsPer1M: data.outputPriceCentsPer1M ?? 0,
          cachedInputPriceCentsPer1M: data.cachedInputPriceCentsPer1M ?? 0,
          currency: data.currency ?? "USD",
          contextWindow: data.contextWindow ?? null,
          isActive: data.isActive ?? true,
          effectiveFrom: data.effectiveFrom ?? new Date(),
        })
        .returning();
      return row;
    },

    async update(id: string, data: {
      modelName?: string | null;
      inputPriceCentsPer1M?: number;
      outputPriceCentsPer1M?: number;
      cachedInputPriceCentsPer1M?: number;
      currency?: string;
      contextWindow?: number | null;
      isActive?: boolean;
      effectiveTo?: Date | null;
    }) {
      const [row] = await db
        .update(modelPricing)
        .set({
          ...(data.modelName !== undefined && { modelName: data.modelName }),
          ...(data.inputPriceCentsPer1M !== undefined && { inputPriceCentsPer1M: data.inputPriceCentsPer1M }),
          ...(data.outputPriceCentsPer1M !== undefined && { outputPriceCentsPer1M: data.outputPriceCentsPer1M }),
          ...(data.cachedInputPriceCentsPer1M !== undefined && { cachedInputPriceCentsPer1M: data.cachedInputPriceCentsPer1M }),
          ...(data.currency !== undefined && { currency: data.currency }),
          ...(data.contextWindow !== undefined && { contextWindow: data.contextWindow }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.effectiveTo !== undefined && { effectiveTo: data.effectiveTo }),
          updatedAt: new Date(),
        })
        .where(eq(modelPricing.id, id))
        .returning();
      return row ?? null;
    },

    async delete(id: string) {
      const [row] = await db.delete(modelPricing).where(eq(modelPricing.id, id)).returning();
      return row ?? null;
    },

    async calculateCost(provider: string, modelId: string, usage: {
      inputTokens?: number;
      outputTokens?: number;
      cachedInputTokens?: number;
    }) {
      const price = await this.findByProviderModel(provider, modelId);
      if (!price) return null;

      const inputTokens = usage.inputTokens ?? 0;
      const outputTokens = usage.outputTokens ?? 0;
      const cachedInputTokens = usage.cachedInputTokens ?? 0;

      const inputCostCents = (inputTokens * price.inputPriceCentsPer1M) / 1_000_000;
      const outputCostCents = (outputTokens * price.outputPriceCentsPer1M) / 1_000_000;
      const cachedInputCostCents = (cachedInputTokens * price.cachedInputPriceCentsPer1M) / 1_000_000;

      return {
        inputCostCents: Math.round(inputCostCents * 100) / 100,
        outputCostCents: Math.round(outputCostCents * 100) / 100,
        cachedInputCostCents: Math.round(cachedInputCostCents * 100) / 100,
        totalCostCents: Math.round((inputCostCents + outputCostCents + cachedInputCostCents) * 100) / 100,
        pricing: price,
      };
    },
  };
}
