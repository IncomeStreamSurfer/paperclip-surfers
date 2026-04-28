import type { UIAdapterModule } from "../types";
import { parseOpenRouterApiStdoutLine } from "./parse-stdout";
import { OpenRouterApiConfigFields } from "./config-fields";
import { buildOpenRouterApiConfig } from "./build-config";

export const openRouterApiUIAdapter: UIAdapterModule = {
  type: "openrouter_api",
  label: "OpenRouter API",
  parseStdoutLine: parseOpenRouterApiStdoutLine,
  ConfigFields: OpenRouterApiConfigFields,
  buildAdapterConfig: buildOpenRouterApiConfig,
};
