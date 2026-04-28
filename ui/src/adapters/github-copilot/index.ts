import type { UIAdapterModule } from "../types";
import { parseGitHubCopilotStdoutLine } from "./parse-stdout";
import { GitHubCopilotConfigFields } from "./config-fields";
import { buildGitHubCopilotConfig } from "./build-config";

export const gitHubCopilotUIAdapter: UIAdapterModule = {
  type: "github_copilot",
  label: "GitHub Copilot",
  parseStdoutLine: parseGitHubCopilotStdoutLine,
  ConfigFields: GitHubCopilotConfigFields,
  buildAdapterConfig: buildGitHubCopilotConfig,
};
