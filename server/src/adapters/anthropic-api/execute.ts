import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString } from "../utils.js";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;
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
  if (!apiKey) throw new Error("anthropic_api adapter requires apiKey in adapterConfig");

  const model = asString(config.model, "claude-sonnet-4-5");

  const body = {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    stream: true,
    system: buildSystemPrompt(agent),
    messages: [{ role: "user", content: buildUserMessage(context) }],
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }

  // Stream SSE response (Anthropic uses event-stream format)
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
        try {
          const chunk = JSON.parse(data) as {
            type?: string;
            delta?: { type?: string; text?: string };
            usage?: { input_tokens?: number; output_tokens?: number };
            message?: { usage?: { input_tokens?: number; output_tokens?: number } };
          };
          if (chunk.type === "content_block_delta" && chunk.delta?.text) {
            await onLog("stdout", chunk.delta.text);
          }
          if (chunk.type === "message_delta" && chunk.usage) {
            outputTokens = chunk.usage.output_tokens ?? 0;
          }
          if (chunk.type === "message_start" && chunk.message?.usage) {
            inputTokens = chunk.message.usage.input_tokens ?? 0;
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
    provider: "anthropic",
    billingType: "api",
    usage: { inputTokens, outputTokens },
  };
}
