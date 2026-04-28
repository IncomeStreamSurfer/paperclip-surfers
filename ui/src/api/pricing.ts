import type { ModelPricing, CreateModelPricing, UpdateModelPricing, CalculatedCost, ModelPricingLookup } from "@paperclipai/shared";
import { api } from "./client";

export async function getPricingList(opts?: { provider?: string }): Promise<ModelPricing[]> {
  const params = new URLSearchParams();
  if (opts?.provider) params.set("provider", opts.provider);
  return api.get<ModelPricing[]>(`/pricing?${params.toString()}`);
}

export async function getPricingEntry(id: string): Promise<ModelPricing> {
  return api.get<ModelPricing>(`/pricing/${id}`);
}

export async function createPricingEntry(data: CreateModelPricing): Promise<ModelPricing> {
  return api.post<ModelPricing>("/pricing", data);
}

export async function updatePricingEntry(id: string, data: UpdateModelPricing): Promise<ModelPricing> {
  return api.patch<ModelPricing>(`/pricing/${id}`, data);
}

export async function deletePricingEntry(id: string): Promise<void> {
  await api.delete(`/pricing/${id}`);
}

export async function calculateCost(data: ModelPricingLookup): Promise<CalculatedCost> {
  return api.post<CalculatedCost>("/pricing/calculate", data);
}
