import { z } from "zod";

export const modelPricingSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1),
  modelId: z.string().min(1),
  modelName: z.string().nullable(),
  inputPriceCentsPer1M: z.number().int().min(0),
  outputPriceCentsPer1M: z.number().int().min(0),
  cachedInputPriceCentsPer1M: z.number().int().min(0),
  currency: z.string(),
  contextWindow: z.number().int().nullable(),
  isActive: z.boolean(),
  source: z.string(),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ModelPricing = z.infer<typeof modelPricingSchema>;

export const createModelPricingSchema = z.object({
  provider: z.string().min(1).max(50),
  modelId: z.string().min(1).max(200),
  modelName: z.string().max(200).optional(),
  inputPriceCentsPer1M: z.number().int().min(0).default(0),
  outputPriceCentsPer1M: z.number().int().min(0).default(0),
  cachedInputPriceCentsPer1M: z.number().int().min(0).default(0),
  currency: z.string().max(10).optional(),
  contextWindow: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  effectiveFrom: z.string().datetime().optional(),
});

export type CreateModelPricing = z.infer<typeof createModelPricingSchema>;

export const updateModelPricingSchema = z.object({
  modelName: z.string().max(200).optional(),
  inputPriceCentsPer1M: z.number().int().min(0).optional(),
  outputPriceCentsPer1M: z.number().int().min(0).optional(),
  cachedInputPriceCentsPer1M: z.number().int().min(0).optional(),
  currency: z.string().max(10).optional(),
  contextWindow: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  effectiveTo: z.string().datetime().optional(),
});

export type UpdateModelPricing = z.infer<typeof updateModelPricingSchema>;

export const modelPricingLookupSchema = z.object({
  provider: z.string().min(1),
  modelId: z.string().min(1),
  inputTokens: z.number().int().min(0).optional(),
  outputTokens: z.number().int().min(0).optional(),
  cachedInputTokens: z.number().int().min(0).optional(),
});

export type ModelPricingLookup = z.infer<typeof modelPricingLookupSchema>;

export const calculatedCostSchema = z.object({
  inputCostCents: z.number(),
  outputCostCents: z.number(),
  cachedInputCostCents: z.number(),
  totalCostCents: z.number(),
  pricing: modelPricingSchema.nullable(),
});

export type CalculatedCost = z.infer<typeof calculatedCostSchema>;
