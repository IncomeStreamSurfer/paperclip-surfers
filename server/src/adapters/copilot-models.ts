import { spawnSync } from "node:child_process";
import type { AdapterModel } from "./types.js";

const COPILOT_MODELS_URL = "https://api.githubcopilot.com/models";
const COPILOT_TOKEN_TIMEOUT_MS = 5_000;
const COPILOT_FETCH_TIMEOUT_MS = 8_000;
const COPILOT_CACHE_TTL_MS = 5 * 60_000; // 5 minutes

let cached: { expiresAt: number; models: AdapterModel[] } | null = null;

/** Try to obtain a GitHub token via the gh CLI. Returns null if gh is not installed or not authenticated. */
function resolveGitHubToken(): string | null {
  // 1. Prefer explicit env vars
  const envToken = (process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "").trim();
  if (envToken) return envToken;

  // 2. Ask the gh CLI
  try {
    const result = spawnSync("gh", ["auth", "token"], {
      encoding: "utf8",
      timeout: COPILOT_TOKEN_TIMEOUT_MS,
      env: {
        ...process.env,
        // Allow gh to find its extension data when installed system-wide
        GH_HOME: process.env.GH_HOME ?? "/usr/local/share/gh",
      },
    });
    const token = (result.stdout ?? "").trim();
    if (token && !result.error && (result.status ?? 1) === 0) return token;
  } catch {
    // gh not available
  }

  return null;
}

/** Fetch model list from the GitHub Copilot API. */
async function fetchCopilotModels(token: string): Promise<AdapterModel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), COPILOT_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(COPILOT_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Headers expected by the Copilot API
        "Editor-Version": "vscode/1.95.0",
        "Editor-Plugin-Version": "copilot-chat/0.22.0",
        "Copilot-Integration-Id": "vscode-chat",
        "User-Agent": "PaperclipAI/1.0",
      },
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const payload = (await res.json()) as unknown;

    // Response shape: { data: Array<{ id, name, version, ... }> }
    const data = Array.isArray((payload as { data?: unknown }).data)
      ? ((payload as { data: unknown[] }).data)
      : Array.isArray(payload)
      ? (payload as unknown[])
      : [];

    const models: AdapterModel[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const id = (item as Record<string, unknown>).id;
      if (typeof id !== "string" || !id.trim()) continue;
      const name =
        (item as Record<string, unknown>).name ??
        (item as Record<string, unknown>).display_name;
      const label = typeof name === "string" && name.trim() ? name.trim() : id;
      models.push({ id: id.trim(), label });
    }

    // Dedupe by id
    const seen = new Set<string>();
    return models.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function listCopilotModels(): Promise<AdapterModel[]> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.models;

  const token = resolveGitHubToken();
  if (!token) return cached?.models ?? [];

  const models = await fetchCopilotModels(token);
  if (models.length > 0) {
    cached = { expiresAt: now + COPILOT_CACHE_TTL_MS, models };
    return models;
  }

  return cached?.models ?? [];
}

export function resetCopilotModelsCacheForTests() {
  cached = null;
}
