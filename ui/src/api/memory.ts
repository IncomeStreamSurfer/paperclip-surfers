import type { MemoryBinding, CreateMemoryBinding, UpdateMemoryBinding, MemoryOperation, MemoryContextBundle, MemoryWriteApi, MemoryQueryApi } from "@paperclipai/shared";
import { api } from "./client";

export async function getMemoryBindings(companyId: string, opts?: { agentId?: string }): Promise<MemoryBinding[]> {
  const params = new URLSearchParams();
  if (opts?.agentId) params.set("agentId", opts.agentId);
  return api.get<MemoryBinding[]>(`/companies/${companyId}/memory-bindings?${params.toString()}`);
}

export async function getMemoryBinding(companyId: string, bindingId: string): Promise<MemoryBinding> {
  return api.get<MemoryBinding>(`/companies/${companyId}/memory-bindings/${bindingId}`);
}

export async function createMemoryBinding(companyId: string, data: CreateMemoryBinding): Promise<MemoryBinding> {
  return api.post<MemoryBinding>(`/companies/${companyId}/memory-bindings`, data);
}

export async function updateMemoryBinding(
  companyId: string,
  bindingId: string,
  data: UpdateMemoryBinding,
): Promise<MemoryBinding> {
  return api.patch<MemoryBinding>(`/companies/${companyId}/memory-bindings/${bindingId}`, data);
}

export async function deleteMemoryBinding(companyId: string, bindingId: string): Promise<void> {
  await api.delete(`/companies/${companyId}/memory-bindings/${bindingId}`);
}

export async function queryMemoryBinding(
  companyId: string,
  bindingId: string,
  data: MemoryQueryApi,
): Promise<MemoryContextBundle> {
  return api.post<MemoryContextBundle>(`/companies/${companyId}/memory-bindings/${bindingId}/query`, data);
}

export async function writeMemoryBinding(
  companyId: string,
  bindingId: string,
  data: MemoryWriteApi,
): Promise<{ records?: { providerKey: string; providerRecordId: string }[]; usage?: { provider: string; latencyMs: number }[] }> {
  return api.post(`/companies/${companyId}/memory-bindings/${bindingId}/write`, data);
}

export async function getMemoryOperations(
  companyId: string,
  opts?: { agentId?: string; bindingId?: string; limit?: number },
): Promise<MemoryOperation[]> {
  const params = new URLSearchParams();
  if (opts?.agentId) params.set("agentId", opts.agentId);
  if (opts?.bindingId) params.set("bindingId", opts.bindingId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  return api.get<MemoryOperation[]>(`/companies/${companyId}/memory-operations?${params.toString()}`);
}
