import type { CreateConfigValues } from "../../components/AgentConfigForm";

export function buildOpenAIApiConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.apiKey) ac.apiKey = v.apiKey;
  if (v.model) ac.model = v.model;
  if (v.baseUrl) ac.baseUrl = v.baseUrl;
  return ac;
}
