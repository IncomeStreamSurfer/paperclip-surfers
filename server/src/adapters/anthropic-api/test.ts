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
      code: "anthropic_api_key_missing",
      level: "error",
      message: "Anthropic API key is required.",
      hint: "Set adapterConfig.apiKey to your Anthropic API key (sk-ant-...).",
    });
  } else {
    checks.push({
      code: "anthropic_api_key_present",
      level: "info",
      message: "API key is configured.",
    });
  }

  if (!model) {
    checks.push({
      code: "anthropic_model_missing",
      level: "warn",
      message: "No model configured; will default to claude-sonnet-4-5.",
      hint: "Set adapterConfig.model to an Anthropic model ID.",
    });
  } else {
    checks.push({
      code: "anthropic_model_configured",
      level: "info",
      message: `Model configured: ${model}`,
    });
  }

  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/models", {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        checks.push({
          code: "anthropic_api_reachable",
          level: "info",
          message: "Anthropic API is reachable and key is valid.",
        });
      } else {
        checks.push({
          code: "anthropic_api_auth_failed",
          level: "error",
          message: `Anthropic API returned ${res.status}. Check your API key.`,
        });
      }
    } catch (err) {
      checks.push({
        code: "anthropic_api_unreachable",
        level: "warn",
        message: err instanceof Error ? err.message : "Could not reach Anthropic API.",
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
