export interface DiscoveredModel {
  id: string;
  provider: string;
  label: string;
  contextLength?: number;
  capabilities: string[];
  rankScore: number;
  installed?: boolean;
}

export interface ModelProviderConfig {
  provider: string;
  type: "ollama" | "openai" | "anthropic" | "google" | "openrouter" | "vllm" | "vercelai" | "azure";
  baseURL?: string;
  apiKey?: string;
  /** Azure OpenAI api-version query param (default: "2024-02-15-preview") */
  apiVersion?: string;
}

const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://192.168.68.230:11434";

const PROVIDER_ENDPOINTS: Record<string, { baseURL: string; listPath: string }> = {
  ollama: {
    baseURL: OLLAMA_HOST,
    listPath: "/api/tags",
  },
  openrouter: {
    baseURL: "https://openrouter.ai/api/v1",
    listPath: "/models",
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    listPath: "/models",
  },
  vercelai: {
    baseURL: "", // user-supplied baseURL required
    listPath: "/models",
  },
};

export async function discoverModelsFromProvider(
  config: ModelProviderConfig,
): Promise<DiscoveredModel[]> {
  const { provider, type, baseURL, apiKey, apiVersion } = config;

  // ── Azure OpenAI (uses deployments API, not /v1/models) ───────────────────
  if (type === "azure") {
    if (!baseURL || !apiKey) return [];
    try {
      const version = apiVersion || "2024-02-15-preview";
      const url = `${baseURL.replace(/\/$/, "")}/openai/deployments?api-version=${version}`;
      const response = await fetch(url, { headers: { "api-key": apiKey } });
      if (!response.ok) return [];
      const data = await response.json() as { value?: Record<string, unknown>[] };
      return (data.value || []).map((m) => ({
        id: `azure/${m.id as string}`,
        provider: "azure",
        label: (m.model as string) || (m.id as string),
        contextLength: 128000,
        capabilities: getCapabilitiesForModel((m.model as string) || (m.id as string)),
        rankScore: calculateRankScore((m.model as string) || (m.id as string), 0),
      }));
    } catch {
      return [];
    }
  }

  const endpoint = PROVIDER_ENDPOINTS[type];

  if (!endpoint && type !== "anthropic" && type !== "google") {
    return [];
  }

  // Vercel AI requires a user-supplied baseURL
  if (type === "vercelai" && !baseURL) return [];

  try {
    let url = (baseURL || endpoint.baseURL) + endpoint.listPath;
    const headers: Record<string, string> = {};

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    if (type === "openrouter" || type === "openai") {
      headers["Authorization"] = `Bearer ${apiKey || process.env.OPENAI_API_KEY || ""}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) return [];

    const data = await response.json();

    if (type === "ollama") {
      return (data.models || []).map((m: Record<string, unknown>) => ({
        id: `ollama/${m.name}`,
        provider: "ollama",
        label: m.name as string,
        contextLength: 128000,
        capabilities: getCapabilitiesForModel(m.name as string),
        rankScore: calculateRankScore(m.name as string, (m.size as number) || 0),
      }));
    }

    if (type === "openrouter" || type === "openai" || type === "vercelai") {
      return (data.data || []).slice(0, 50).map((m: Record<string, unknown>) => ({
        id: `${provider}/${m.id}`,
        provider,
        label: m.id as string,
        contextLength: (m.context_limit as number) || 128000,
        capabilities: getCapabilitiesForModel(m.id as string),
        rankScore: calculateRankScore(m.id as string, 0),
      }));
    }

    return [];
  } catch {
    return [];
  }
}

function getCapabilitiesForModel(modelId: string): string[] {
  const lower = modelId.toLowerCase();
  const capabilities: string[] = [];

  if (lower.includes("code") || lower.includes("coder") || lower.includes("dev")) {
    capabilities.push("code");
  }
  if (lower.includes("vision") || lower.includes("vision")) {
    capabilities.push("vision");
  }
  if (lower.includes("embed")) {
    capabilities.push("embedding");
  }
  if (lower.includes("large") || lower.includes("72b") || lower.includes("405b")) {
    capabilities.push("large");
  }
  if (lower.includes("fast") || lower.includes("mini") || lower.includes("tiny")) {
    capabilities.push("fast");
  }
  if (lower.includes("reasoning") || lower.includes("think")) {
    capabilities.push("reasoning");
  }

  if (capabilities.length === 0) {
    capabilities.push("general");
  }

  return capabilities;
}

function calculateRankScore(modelId: string, sizeBytes: number): number {
  const lower = modelId.toLowerCase();
  let score = 50;

  if (lower.includes("kimi") || lower.includes("4.5") || lower.includes("4.5")) score += 30;
  else if (lower.includes("claude") && lower.includes("sonnet")) score += 25;
  else if (lower.includes("gpt-5") || lower.includes("gpt5")) score += 25;
  else if (lower.includes("o1") || lower.includes("reasoning")) score += 20;
  else if (lower.includes("4o") || lower.includes("flash")) score += 15;

  if (lower.includes("code") || lower.includes("coder")) score += 15;
  if (lower.includes("large") || lower.includes("72b") || lower.includes("405b")) score += 10;
  else if (lower.includes("medium") || lower.includes("8b") || lower.includes("70b")) score += 5;

  if (lower.includes("fast") || lower.includes("mini") || lower.includes("tiny")) score -= 10;

  if (sizeBytes > 50000000000) score += 5;

  return Math.max(0, Math.min(100, score));
}

export async function getModelSuggestions(
  useCase?: "code" | "reasoning" | "fast" | "general",
  allowedModelIds?: string[],
): Promise<DiscoveredModel[]> {
  const allModels: DiscoveredModel[] = [];

  const providers: ModelProviderConfig[] = [
    { provider: "ollama", type: "ollama" },
  ];

  if (process.env.OPENAI_API_KEY) {
    providers.push({ provider: "openai", type: "openai" });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({ provider: "openrouter", type: "openrouter" });
  }

  for (const config of providers) {
    try {
      const models = await discoverModelsFromProvider(config);
      allModels.push(...models);
    } catch {
    }
  }

  let filtered = allModels;

  // Pro+ filtering: only include models in the allowed list
  if (allowedModelIds && allowedModelIds.length > 0) {
    filtered = filtered.filter((m) => allowedModelIds.includes(m.id));
  }

  if (useCase) {
    filtered = filtered.filter((m) => m.capabilities.includes(useCase));
  }

  filtered.sort((a, b) => b.rankScore - a.rankScore);

  return filtered.slice(0, 20);
}

export async function getAvailableOllamaModels(): Promise<DiscoveredModel[]> {
  try {
    const response = await fetch("https://ollama.com/library?offset=0&limit=50");
    if (!response.ok) return [];

    const html = await response.text();
    const modelMatches = html.matchAll(/href="\/library\/([a-zA-Z0-9_-]+)"/g);
    const modelNames = [...new Set([...modelMatches].map((m) => m[1]))];

    const installed = await discoverModelsFromProvider({ provider: "ollama", type: "ollama" });
    const installedNames = new Set(installed.map((m) => m.label));

    return modelNames
      .filter((name) => !installedNames.has(name))
      .map((name) => ({
        id: `ollama/${name}`,
        provider: "ollama",
        label: name,
        contextLength: 128000,
        capabilities: getCapabilitiesForModel(name),
        rankScore: calculateRankScore(name, 0),
        installed: false,
      }));
  } catch {
    return [];
  }
}

export async function installOllamaModel(modelName: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName, stream: false }),
    });

    if (response.ok) {
      return { success: true, message: `Model ${modelName} installed successfully` };
    }
    return { success: false, message: `Failed to install ${modelName}` };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
}

export async function getAllAvailableModels(): Promise<DiscoveredModel[]> {
  return getModelSuggestions();
}

export async function getInstalledOllamaModels(): Promise<DiscoveredModel[]> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) return [];
    const data = await response.json() as { models?: Record<string, unknown>[] };
    return (data.models || []).map((m) => ({
      id: `ollama/${m.name as string}`,
      provider: "ollama",
      label: m.name as string,
      contextLength: 128000,
      capabilities: getCapabilitiesForModel(m.name as string),
      rankScore: calculateRankScore(m.name as string, (m.size as number) || 0),
      installed: true,
    }));
  } catch {
    return [];
  }
}

export async function deleteOllamaModel(modelName: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/delete`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: modelName }),
    });
    if (response.ok) {
      return { success: true, message: `Model ${modelName} deleted` };
    }
    return { success: false, message: `Failed to delete ${modelName}` };
  } catch (error) {
    return { success: false, message: `Error: ${error}` };
  }
}

export async function getVllmModels(baseURL: string, apiKey?: string): Promise<DiscoveredModel[]> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
    const response = await fetch(`${baseURL}/v1/models`, { headers });
    if (!response.ok) return [];
    const data = await response.json() as { data?: Record<string, unknown>[] };
    return (data.data || []).map((m) => ({
      id: `vllm/${m.id as string}`,
      provider: "vllm",
      label: m.id as string,
      contextLength: (m.max_model_len as number) || 128000,
      capabilities: getCapabilitiesForModel(m.id as string),
      rankScore: calculateRankScore(m.id as string, 0),
      installed: true,
    }));
  } catch {
    return [];
  }
}

export function getCapabilityLabel(capabilities: string[]): string {
  if (capabilities.includes("code")) return "Code";
  if (capabilities.includes("vision")) return "Vision";
  if (capabilities.includes("reasoning")) return "Reasoning";
  if (capabilities.includes("fast")) return "Fast";
  if (capabilities.includes("large")) return "Large";
  if (capabilities.includes("embedding")) return "Embedding";
  return "General";
}