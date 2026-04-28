import { api } from "./client";
import type { AdapterModel } from "./agents";

export interface DiscoveredModel {
  id: string;
  provider: string;
  label: string;
  contextLength?: number;
  capabilities: string[];
  rankScore: number;
  installed?: boolean;
}

export interface AllowedModel {
  id: string;
  companyId: string;
  modelId: string;
  provider: string;
  enabled: boolean;
  allowedAt: string;
  allowedByUserId: string | null;
}

export interface AgentWithModel {
  id: string;
  name: string;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
}

export interface VllmEndpoint {
  id: string;
  name: string;
  baseURL: string;
  apiKey: string;
}

export interface ApiKeyStatus {
  configured: boolean;
  maskedKey: string | null;
  /** Present for providers that require a base URL (Vercel AI, Azure OpenAI) */
  url?: string | null;
  /** Azure OpenAI api-version */
  apiVersion?: string | null;
}

export const modelsApi = {
  getSuggestions: (useCase?: string, companyId?: string) =>
    api.get<AdapterModel[]>(`/models/suggestions${useCase ? `?useCase=${useCase}` : ""}${companyId ? `${useCase ? "&" : "?"}companyId=${companyId}` : ""}`),

  getAvailable: () =>
    api.get<AdapterModel[]>("/models/available"),

  getInstalled: () =>
    api.get<AdapterModel[]>("/models/installed"),

  installModel: (modelName: string) =>
    api.post<{ success: boolean; message: string }>("/models/install", { modelName }),

  deleteOllamaModel: (modelName: string) =>
    api.delete<{ success: boolean; message: string }>(`/models/ollama/${encodeURIComponent(modelName)}`),

  getAllowedModels: (companyId: string) =>
    api.get<{ models: AllowedModel[] }>(`/companies/${companyId}/models/allowed`),

  updateAllowedModels: (companyId: string, models: Array<{ modelId: string; provider: string; enabled: boolean }>) =>
    api.patch<{ models: AllowedModel[] }>(`/companies/${companyId}/models/allowed`, { models }),

  toggleModel: (companyId: string, modelId: string, enabled: boolean) =>
    api.patch<{ model: AllowedModel }>(`/companies/${companyId}/models/allowed/${modelId}`, { enabled }),

  getAgentsWithModels: (companyId: string) =>
    api.get<{ agents: AgentWithModel[] }>(`/companies/${companyId}/agents/models`),

  bulkUpdateAgentsModels: (companyId: string, updates: Array<{ agentId: string; model: string }>) =>
    api.patch<{ agents: AgentWithModel[] }>(`/companies/${companyId}/agents/models`, { updates }),

  // vLLM endpoint management
  getVllmEndpoints: () =>
    api.get<{ endpoints: VllmEndpoint[] }>("/models/vllm/endpoints"),

  addVllmEndpoint: (data: { name: string; baseURL: string; apiKey?: string }) =>
    api.post<{ endpoint: VllmEndpoint }>("/models/vllm/endpoints", data),

  deleteVllmEndpoint: (id: string) =>
    api.delete<{ ok: boolean }>(`/models/vllm/endpoints/${id}`),

  probeVllmEndpoint: (id: string) =>
    api.get<AdapterModel[]>(`/models/vllm/endpoints/${id}/models`),

  /** Returns available ComfyUI checkpoints. Empty list when ComfyUI is unreachable. */
  getImageCheckpoints: () =>
    api.get<{ checkpoints: string[]; available: boolean }>("/models/image-checkpoints"),

  // ── OpenAI ────────────────────────────────────────────────────────────────
  getOpenAIKeyStatus: () =>
    api.get<ApiKeyStatus>("/models/openai/key"),

  saveOpenAIKey: (apiKey: string) =>
    api.post<{ ok: boolean; maskedKey: string }>("/models/openai/key", { apiKey }),

  removeOpenAIKey: () =>
    api.delete<{ ok: boolean }>("/models/openai/key"),

  getOpenAIModels: () =>
    api.get<AdapterModel[]>("/models/openai/models"),

  // ── OpenRouter ────────────────────────────────────────────────────────────
  getOpenRouterKeyStatus: () =>
    api.get<ApiKeyStatus>("/models/openrouter/key"),

  saveOpenRouterKey: (apiKey: string) =>
    api.post<{ ok: boolean; maskedKey: string }>("/models/openrouter/key", { apiKey }),

  removeOpenRouterKey: () =>
    api.delete<{ ok: boolean }>("/models/openrouter/key"),

  getOpenRouterModels: () =>
    api.get<AdapterModel[]>("/models/openrouter/models"),

  // ── Vercel AI Gateway ─────────────────────────────────────────────────────
  getVercelAIKeyStatus: () =>
    api.get<ApiKeyStatus>("/models/vercelai/key"),

  saveVercelAIKey: (apiKey: string, baseURL: string) =>
    api.post<{ ok: boolean; maskedKey: string }>("/models/vercelai/key", { apiKey, baseURL }),

  removeVercelAIKey: () =>
    api.delete<{ ok: boolean }>("/models/vercelai/key"),

  getVercelAIModels: () =>
    api.get<AdapterModel[]>("/models/vercelai/models"),

  // ── Azure OpenAI ──────────────────────────────────────────────────────────
  getAzureKeyStatus: () =>
    api.get<ApiKeyStatus>("/models/azure/key"),

  saveAzureKey: (apiKey: string, endpoint: string, apiVersion?: string) =>
    api.post<{ ok: boolean; maskedKey: string }>("/models/azure/key", { apiKey, endpoint, apiVersion }),

  removeAzureKey: () =>
    api.delete<{ ok: boolean }>("/models/azure/key"),

  getAzureModels: () =>
    api.get<AdapterModel[]>("/models/azure/models"),

  /** Aggregate all models from all configured providers (Ollama, OpenAI, OpenRouter, Vercel AI, Azure, vLLM) */
  getAllModels: () =>
    api.get<{ models: DiscoveredModel[] }>("/models/all"),
};