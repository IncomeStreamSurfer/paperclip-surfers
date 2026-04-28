import { spawnSync } from "node:child_process";
import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString } from "../utils.js";

const COPILOT_COMPLETIONS_URL = "https://api.githubcopilot.com/chat/completions";
const COPILOT_TOKEN_TIMEOUT_MS = 5_000;
const REQUEST_TIMEOUT_MS = 60_000;

function resolveGitHubToken(config: Record<string, unknown>): string | null {
  const explicitKey = asString(config.apiKey, "").trim();
  if (explicitKey) return explicitKey;
  const envToken = (process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? "").trim();
  if (envToken) return envToken;
  try {
    const result = spawnSync("gh", ["auth", "token"], {
      encoding: "utf8",
      timeout: COPILOT_TOKEN_TIMEOUT_MS,
      env: { ...process.env, GH_HOME: process.env.GH_HOME ?? "/usr/local/share/gh" },
    });
    const token = (result.stdout ?? "").trim();
    if (token && !result.error && (result.status ?? 1) === 0) return token;
  } catch {
    // gh not available
  }
  return null;
}

function buildSystemPrompt(agent: AdapterExecutionContext["agent"]): string {
  return `You are ${agent.name}, an AI agent running inside Paperclip. Complete the assigned task concisely.`;
}

function buildUserMessage(context: Record<string, unknown>): string {
  return JSON.stringify(context, null, 2);
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, agent, context, onLog } = ctx;

  const token = resolveGitHubToken(config);
  if (!token) {
    throw new Error(
      "github_copilot adapter requires a GitHub token. Run `gh auth login` or set GITHUB_TOKEN env var.",
    );
  }

  const model = asString(config.model, "gpt-4o");

  const body = {
    model,
    stream: true,
    messages: [
      { role: "system", content: buildSystemPrompt(agent) },
      { role: "user", content: buildUserMessage(context) },
    ],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const res = await fetch(COPILOT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Editor-Version": "vscode/1.95.0",
      "Editor-Plugin-Version": "copilot-chat/0.22.0",
      "Copilot-Integration-Id": "vscode-chat",
      "User-Agent": "PaperclipAI/1.0",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub Copilot API error ${res.status}: ${text}`);
  }

  // Stream SSE response (OpenAI-compatible)
  let inputTokens = 0;
  let outputTokens = 0;
  const reader = res.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            await onLog("stdout", content);
          }
          if (chunk.usage) {
            inputTokens = chunk.usage.prompt_tokens ?? 0;
            outputTokens = chunk.usage.completion_tokens ?? 0;
          }
        } catch {
          // ignore malformed chunks
        }
      }
    }
  }

  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    model,
    provider: "github_copilot",
    billingType: "subscription",
    usage: { inputTokens, outputTokens },
  };
}
