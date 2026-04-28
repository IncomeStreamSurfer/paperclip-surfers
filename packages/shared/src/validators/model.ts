import { z } from "zod";
import { MODEL_PROVIDERS } from "../constants.js";

export const allowedModelSchema = z.object({
  modelId: z.string().min(1),
  provider: z.enum(MODEL_PROVIDERS),
  enabled: z.boolean().default(true),
});

export type AllowedModel = z.infer<typeof allowedModelSchema>;

export const updateAllowedModelsSchema = z.object({
  models: z.array(allowedModelSchema),
});

export type UpdateAllowedModels = z.infer<typeof updateAllowedModelsSchema>;

export const toggleModelSchema = z.object({
  modelId: z.string().min(1),
  enabled: z.boolean(),
});

export type ToggleModel = z.infer<typeof toggleModelSchema>;