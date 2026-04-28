import type { MemoryAdapter } from "@paperclipai/shared";
import { ChromaMemoryAdapter } from "./chroma-adapter.js";

const registry = new Map<string, Map<string, MemoryAdapter>>();

export function registerMemoryAdapter(companyId: string, key: string, adapter: MemoryAdapter): void {
  if (!registry.has(companyId)) {
    registry.set(companyId, new Map());
  }
  registry.get(companyId)!.set(key, adapter);
}

export function getMemoryAdapter(companyId: string, key: string): MemoryAdapter | null {
  return registry.get(companyId)?.get(key) ?? null;
}

export function listMemoryAdapters(companyId: string): MemoryAdapter[] {
  return Array.from(registry.get(companyId)?.values() ?? []);
}

export function unregisterMemoryAdapter(companyId: string, key: string): void {
  registry.get(companyId)?.delete(key);
}

export function createChromaAdapter(opts: {
  companyId: string;
  scope: "company" | "agent" | "project" | "issue";
  scopeId?: string;
  topK?: number;
  minScore?: number;
}): MemoryAdapter {
  return new ChromaMemoryAdapter(opts);
}
