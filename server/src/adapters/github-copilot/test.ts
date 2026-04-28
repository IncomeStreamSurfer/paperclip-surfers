import { spawnSync } from "node:child_process";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

const COPILOT_TOKEN_TIMEOUT_MS = 5_000;

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

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

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const model = asString(config.model, "");

  const token = resolveGitHubToken(config);
  if (!token) {
    checks.push({
      code: "copilot_token_missing",
      level: "error",
      message: "No GitHub token found.",
      hint: "Run `gh auth login` to authenticate, set GITHUB_TOKEN env var, or add apiKey to adapterConfig.",
    });
  } else {
    checks.push({
      code: "copilot_token_present",
      level: "info",
      message: "GitHub token is available.",
    });

    // Probe the Copilot models endpoint
    try {
      const res = await fetch("https://api.githubcopilot.com/models", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Editor-Version": "vscode/1.95.0",
          "Editor-Plugin-Version": "copilot-chat/0.22.0",
          "Copilot-Integration-Id": "vscode-chat",
          "User-Agent": "PaperclipAI/1.0",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        checks.push({
          code: "copilot_api_reachable",
          level: "info",
          message: "GitHub Copilot API is reachable.",
        });
      } else {
        checks.push({
          code: "copilot_api_auth_failed",
          level: "error",
          message: `GitHub Copilot API returned ${res.status}. Ensure Copilot is enabled on your account.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "copilot_api_unreachable",
        level: "warn",
        message: err instanceof Error ? err.message : "Could not reach GitHub Copilot API.",
        hint: "Verify network connectivity from the Paperclip server.",
      });
    }
  }

  if (!model) {
    checks.push({
      code: "copilot_model_missing",
      level: "warn",
      message: "No model configured; will default to gpt-4o.",
      hint: "Set adapterConfig.model to a GitHub Copilot model ID.",
    });
  } else {
    checks.push({
      code: "copilot_model_configured",
      level: "info",
      message: `Model configured: ${model}`,
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
