import type { CreateConfigValues } from "../../components/AgentConfigForm";

export function buildGitHubCopilotConfig(v: CreateConfigValues): Record<string, unknown> {
  const ac: Record<string, unknown> = {};
  if (v.model) ac.model = v.model;
  return ac;
}
