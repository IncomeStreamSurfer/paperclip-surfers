import type { UIAdapterModule } from "../types";
import { parseAnthropicApiStdoutLine } from "./parse-stdout";
import { AnthropicApiConfigFields } from "./config-fields";
import { buildAnthropicApiConfig } from "./build-config";

export const anthropicApiUIAdapter: UIAdapterModule = {
  type: "anthropic_api",
  label: "Anthropic API",
  parseStdoutLine: parseAnthropicApiStdoutLine,
  ConfigFields: AnthropicApiConfigFields,
  buildAdapterConfig: buildAnthropicApiConfig,
};
