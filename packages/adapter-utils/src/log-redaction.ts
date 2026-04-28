import type { TranscriptEntry } from "./types.js";

export const REDACTED_HOME_PATH_USER = "*";
export const REDACTED_API_KEY = "[REDACTED]";

export interface HomePathRedactionOptions {
  enabled?: boolean;
}

// Patterns that match well-known API key formats leaked via agent stderr/stdout.
// Each regex must have the 'g' flag so String.replace handles all occurrences.
const API_KEY_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9]{20,}/g,             // OpenAI sk- keys
  /sk-or-[A-Za-z0-9]{20,}/g,          // OpenRouter sk-or- keys
  /sk-ant-[A-Za-z0-9\-]{20,}/g,       // Anthropic sk-ant- keys
  /AIza[A-Za-z0-9\-_]{35}/g,          // Google AI / GCP API keys
  /[A-Za-z0-9]{32}-us[0-9]+/g,        // Mailchimp-style keys
  /ghp_[A-Za-z0-9]{36}/g,             // GitHub personal access tokens
  /ghu_[A-Za-z0-9]{36}/g,             // GitHub user-to-server tokens
  /Bearer\s+[A-Za-z0-9\-_.]{20,}/g,   // Generic Bearer tokens in text
];

export function redactApiKeys(text: string): string {
  let result = text;
  for (const pattern of API_KEY_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, REDACTED_API_KEY);
  }
  return result;
}

function maskHomePathUserSegment(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return REDACTED_HOME_PATH_USER;
  return `${trimmed[0]}${"*".repeat(Math.max(1, Array.from(trimmed).length - 1))}`;
}

const HOME_PATH_PATTERNS = [
  {
    regex: /\/Users\/([^/\\\s]+)/g,
    replace: (_match: string, user: string) => `/Users/${maskHomePathUserSegment(user)}`,
  },
  {
    regex: /\/home\/([^/\\\s]+)/g,
    replace: (_match: string, user: string) => `/home/${maskHomePathUserSegment(user)}`,
  },
  {
    regex: /([A-Za-z]:\\Users\\)([^\\/\s]+)/g,
    replace: (_match: string, prefix: string, user: string) => `${prefix}${maskHomePathUserSegment(user)}`,
  },
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function redactHomePathUserSegments(text: string, opts?: HomePathRedactionOptions): string {
  if (opts?.enabled === false) return text;
  let result = redactApiKeys(text);
  for (const pattern of HOME_PATH_PATTERNS) {
    result = result.replace(pattern.regex, pattern.replace);
  }
  return result;
}

export function redactHomePathUserSegmentsInValue<T>(value: T, opts?: HomePathRedactionOptions): T {
  if (typeof value === "string") {
    return redactHomePathUserSegments(value, opts) as T;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactHomePathUserSegmentsInValue(entry, opts)) as T;
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = redactHomePathUserSegmentsInValue(entry, opts);
  }
  return redacted as T;
}

export function redactTranscriptEntryPaths(entry: TranscriptEntry, opts?: HomePathRedactionOptions): TranscriptEntry {
  switch (entry.kind) {
    case "assistant":
    case "thinking":
    case "user":
    case "stderr":
    case "system":
    case "stdout":
      return { ...entry, text: redactHomePathUserSegments(entry.text, opts) };
    case "tool_call":
      return {
        ...entry,
        name: redactHomePathUserSegments(entry.name, opts),
        input: redactHomePathUserSegmentsInValue(entry.input, opts),
      };
    case "tool_result":
      return { ...entry, content: redactHomePathUserSegments(entry.content, opts) };
    case "init":
      return {
        ...entry,
        model: redactHomePathUserSegments(entry.model, opts),
        sessionId: redactHomePathUserSegments(entry.sessionId, opts),
      };
    case "result":
      return {
        ...entry,
        text: redactHomePathUserSegments(entry.text, opts),
        subtype: redactHomePathUserSegments(entry.subtype, opts),
        errors: entry.errors.map((error) => redactHomePathUserSegments(error, opts)),
      };
    default:
      return entry;
  }
}
