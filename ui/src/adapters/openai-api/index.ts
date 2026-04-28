import type { UIAdapterModule } from "../types";
import { parseOpenAIApiStdoutLine } from "./parse-stdout";
import { OpenAIApiConfigFields } from "./config-fields";
import { buildOpenAIApiConfig } from "./build-config";

export const openAIApiUIAdapter: UIAdapterModule = {
  type: "openai_api",
  label: "OpenAI API",
  parseStdoutLine: parseOpenAIApiStdoutLine,
  ConfigFields: OpenAIApiConfigFields,
  buildAdapterConfig: buildOpenAIApiConfig,
};
