import { api } from "./client";

export interface CliStatus {
  id: string;
  label: string;
  description: string;
  homepage: string;
  binary: string;
  installed: boolean;
  version: string | null;
  authMethod: "api_key" | "oauth_device" | "pat_token" | "none";
  supportsApiKey: boolean;
  keyEnvVar: string | null;
  installMethod: "npm" | "pip" | "system" | "curl" | "none";
  installPackage: string | null;
  status: "authenticated" | "api_key_set" | "unauthenticated" | "not_installed" | "unknown";
  detail: string | null;
  category: string;
}

export interface CliCredentialsStatusResponse {
  clis: CliStatus[];
}

export interface GhDeviceFlowStart {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GhDeviceFlowPoll {
  access_token?: string;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export const cliCredentialsApi = {
  getStatus: () =>
    api.get<CliCredentialsStatusResponse>("/instance/cli-credentials/status"),

  setApiKey: (cli: string, key: string) =>
    api.post<{ ok: boolean }>(`/instance/cli-credentials/${cli}/api-key`, { key }),

  clearApiKey: (cli: string) =>
    api.delete<void>(`/instance/cli-credentials/${cli}/api-key`),

  ghDeviceFlowStart: () =>
    api.post<GhDeviceFlowStart>("/instance/cli-credentials/gh/device-flow/start", {}),

  ghDeviceFlowPoll: (device_code: string) =>
    api.post<GhDeviceFlowPoll>("/instance/cli-credentials/gh/device-flow/poll", { device_code }),
};
