import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((c) => c.level === "error")) return "fail";
  if (checks.some((c) => c.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const apiKey = asString(config.apiKey, "");
  const model = asString(config.model, "");

  if (!apiKey) {
    checks.push({
      code: "openai_api_key_missing",
      level: "error",
      message: "OpenAI API key is required.",
      hint: "Set adapterConfig.apiKey to your OpenAI API key (sk-...).",
    });
  } else {
    checks.push({
      code: "openai_api_key_present",
      level: "info",
      message: "API key is configured.",
    });
  }

  if (!model) {
    checks.push({
      code: "openai_model_missing",
      level: "warn",
      message: "No model configured; will default to gpt-4o.",
      hint: "Set adapterConfig.model to an OpenAI model ID.",
    });
  } else {
    checks.push({
      code: "openai_model_configured",
      level: "info",
      message: `Model configured: ${model}`,
    });
  }

  if (apiKey) {
    const baseUrl = asString(config.baseUrl, "https://api.openai.com/v1").replace(/\/$/, "");
    try {
      const res = await fetch(`${baseUrl}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        checks.push({
          code: "openai_api_reachable",
          level: "info",
          message: "OpenAI API is reachable and key is valid.",
        });
      } else {
        checks.push({
          code: "openai_api_auth_failed",
          level: "error",
          message: `OpenAI API returned ${res.status}. Check your API key.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "openai_api_unreachable",
        level: "warn",
        message: err instanceof Error ? err.message : "Could not reach OpenAI API.",
        hint: "Verify network connectivity from the Paperclip server.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
