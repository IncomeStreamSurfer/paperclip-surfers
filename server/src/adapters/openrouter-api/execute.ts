import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString } from "../utils.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_SITE_URL = "https://paperclip.ai";
const OPENROUTER_SITE_NAME = "Paperclip";
const REQUEST_TIMEOUT_MS = 60_000;

function buildSystemPrompt(agent: AdapterExecutionContext["agent"]): string {
  return `You are ${agent.name}, an AI agent running inside Paperclip. Complete the assigned task concisely.`;
}

function buildUserMessage(context: Record<string, unknown>): string {
  return JSON.stringify(context, null, 2);
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, agent, context, onLog } = ctx;

  const apiKey = asString(config.apiKey, "");
  if (!apiKey) throw new Error("openrouter_api adapter requires apiKey in adapterConfig");

  const model = asString(config.model, "openai/gpt-4o");

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

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": OPENROUTER_SITE_URL,
      "X-Title": OPENROUTER_SITE_NAME,
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter API error ${res.status}: ${text}`);
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
    provider: "openrouter",
    billingType: "api",
    usage: { inputTokens, outputTokens },
  };
}
