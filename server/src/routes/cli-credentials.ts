/**
 * CLI Credentials — authenticate and install AI CLIs from the web UI.
 *
 * Routes (all under /api):
 *   GET  /instance/cli-credentials/status
 *   GET  /instance/cli-credentials/catalog
 *   GET  /instance/cli-credentials/:cli/install   (SSE — streams install output)
 *   POST /instance/cli-credentials/:cli/api-key   { key }
 *   DELETE /instance/cli-credentials/:cli/api-key
 *   POST /instance/cli-credentials/gh/device-flow/start
 *   POST /instance/cli-credentials/gh/device-flow/poll { device_code }
 */

import { Router, type Request } from "express";
import { spawnSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { forbidden } from "../errors.js";

// ─── Credential storage ───────────────────────────────────────────────────────

const CREDS_PATH = process.env.CLI_CREDS_PATH ?? "/paperclip/cli-credentials.json";
const CREDS_FALLBACK = path.join(process.env.HOME ?? "/root", ".paperclip-cli-credentials.json");

interface CliCredentials {
  anthropic_api_key?: string;
  openai_api_key?: string;
  gemini_api_key?: string;
  google_api_key?: string;
  github_token?: string;
  opencode_api_key?: string;
}

function credsFilePath(): string {
  try {
    const dir = path.dirname(CREDS_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return CREDS_PATH;
  } catch {
    return CREDS_FALLBACK;
  }
}

function readCreds(): CliCredentials {
  try {
    return JSON.parse(fs.readFileSync(credsFilePath(), "utf8")) as CliCredentials;
  } catch {
    return {};
  }
}

function writeCreds(creds: CliCredentials) {
  fs.writeFileSync(credsFilePath(), JSON.stringify(creds, null, 2), { mode: 0o600 });
}

function runtimeEnv(overrides?: Record<string, string>): Record<string, string> {
  const c = readCreds();
  return {
    ...process.env,
    ...(c.anthropic_api_key ? { ANTHROPIC_API_KEY: c.anthropic_api_key } : {}),
    ...(c.openai_api_key ? { OPENAI_API_KEY: c.openai_api_key } : {}),
    ...(c.gemini_api_key ? { GEMINI_API_KEY: c.gemini_api_key } : {}),
    ...(c.google_api_key ? { GOOGLE_API_KEY: c.google_api_key } : {}),
    ...(c.github_token ? { GITHUB_TOKEN: c.github_token, GH_TOKEN: c.github_token } : {}),
    ...(overrides ?? {}),
  } as Record<string, string>;
}

// ─── Process helpers ──────────────────────────────────────────────────────────

const PROBE_TIMEOUT = 8_000;

function run(cmd: string, args: string[], env?: Record<string, string>, input?: string) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    timeout: PROBE_TIMEOUT,
    env: env ?? runtimeEnv(),
    input,
    stdio: input !== undefined ? ["pipe", "pipe", "pipe"] : undefined,
  });
  return {
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
    ok: (result.status ?? 1) === 0,
    error: result.error,
  };
}

function commandExists(cmd: string): boolean {
  try {
    return (spawnSync("which", [cmd], { encoding: "utf8", timeout: 3_000 }).status ?? 1) === 0;
  } catch {
    return false;
  }
}

function commandVersion(cmd: string): string | null {
  try {
    const r = spawnSync(cmd, ["--version"], { encoding: "utf8", timeout: 4_000 });
    const out = ((r.stdout ?? "") + (r.stderr ?? "")).trim();
    const firstLine = out.split(/\r?\n/)[0]?.trim() ?? "";
    return firstLine || null;
  } catch {
    return null;
  }
}

// ─── CLI catalog ──────────────────────────────────────────────────────────────

export type InstallMethod = "npm" | "pip" | "system" | "curl" | "none";
export type AuthMethod = "api_key" | "oauth_device" | "pat_token" | "none";

export interface CliCatalogEntry {
  id: string;
  label: string;
  description: string;
  homepage: string;
  binary: string;
  authMethod: AuthMethod;
  supportsApiKey: boolean;
  keyEnvVar: string | null;
  installMethod: InstallMethod;
  /** npm package, pip package, or curl URL */
  installPackage: string | null;
  /** extra commands to run after the primary install (e.g. post-install script) */
  postInstallCmds?: Array<{ cmd: string; args: string[] }>;
  category: "coding" | "chat" | "search" | "utility";
}

const CLI_CATALOG: CliCatalogEntry[] = [
  {
    id: "claude",
    label: "Claude Code",
    description: "Anthropic's agentic coding CLI. Supports subscription login or API key.",
    homepage: "https://docs.anthropic.com/claude-code",
    binary: "claude",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: "ANTHROPIC_API_KEY",
    installMethod: "npm",
    installPackage: "@anthropic-ai/claude-code@latest",
    category: "coding",
  },
  {
    id: "gh",
    label: "GitHub CLI",
    description: "GitHub's official CLI — required for GitHub Copilot model access.",
    homepage: "https://cli.github.com",
    binary: "gh",
    authMethod: "oauth_device",
    supportsApiKey: true,
    keyEnvVar: "GITHUB_TOKEN",
    installMethod: "system",
    installPackage: null,
    category: "utility",
  },
  {
    id: "gemini",
    label: "Gemini CLI",
    description: "Google's Gemini agentic CLI. Accepts a Gemini API key or Google account login.",
    homepage: "https://github.com/google-gemini/gemini-cli",
    binary: "gemini",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: "GEMINI_API_KEY",
    installMethod: "npm",
    installPackage: "@google/gemini-cli@latest",
    category: "coding",
  },
  {
    id: "codex",
    label: "OpenAI Codex",
    description: "OpenAI's agentic CLI coding assistant. Requires an OpenAI API key.",
    homepage: "https://github.com/openai/codex",
    binary: "codex",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: "OPENAI_API_KEY",
    installMethod: "npm",
    installPackage: "@openai/codex@latest",
    category: "coding",
  },
  {
    id: "opencode",
    label: "OpenCode",
    description: "Multi-provider open-source agentic coding assistant. Picks up any configured provider key.",
    homepage: "https://opencode.ai",
    binary: "opencode",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: null,
    installMethod: "npm",
    installPackage: "opencode-ai@latest",
    category: "coding",
  },
  {
    id: "aider",
    label: "Aider",
    description: "AI pair programming in your terminal. Works with OpenAI, Anthropic, and local models.",
    homepage: "https://aider.chat",
    binary: "aider",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: "OPENAI_API_KEY",
    installMethod: "pip",
    installPackage: "aider-install",
    postInstallCmds: [{ cmd: "aider-install", args: [] }],
    category: "coding",
  },
  {
    id: "goose",
    label: "Goose",
    description: "Block's open-source AI developer agent. Autonomous task execution across tools.",
    homepage: "https://github.com/block/goose",
    binary: "goose",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: "OPENAI_API_KEY",
    installMethod: "curl",
    installPackage: "https://github.com/block/goose/releases/latest/download/goose-x86_64-unknown-linux-gnu.tar.gz",
    category: "coding",
  },
  {
    id: "llm",
    label: "LLM (Simon Willison)",
    description: "CLI tool to interact with language models. Supports many providers and local models.",
    homepage: "https://llm.datasette.io",
    binary: "llm",
    authMethod: "api_key",
    supportsApiKey: true,
    keyEnvVar: "OPENAI_API_KEY",
    installMethod: "pip",
    installPackage: "llm",
    category: "chat",
  },
];

const CLI_BY_ID = new Map(CLI_CATALOG.map((c) => [c.id, c]));

// ─── Status checks ────────────────────────────────────────────────────────────

export interface CliStatus {
  id: string;
  label: string;
  description: string;
  homepage: string;
  binary: string;
  installed: boolean;
  version: string | null;
  authMethod: AuthMethod;
  supportsApiKey: boolean;
  keyEnvVar: string | null;
  installMethod: InstallMethod;
  installPackage: string | null;
  status: "authenticated" | "api_key_set" | "unauthenticated" | "not_installed" | "unknown";
  detail: string | null;
  category: string;
}

function catalogToStatus(entry: CliCatalogEntry, installed: boolean, version: string | null,
  status: CliStatus["status"], detail: string | null): CliStatus {
  return {
    id: entry.id,
    label: entry.label,
    description: entry.description,
    homepage: entry.homepage,
    binary: entry.binary,
    installed,
    version,
    authMethod: entry.authMethod,
    supportsApiKey: entry.supportsApiKey,
    keyEnvVar: entry.keyEnvVar,
    installMethod: entry.installMethod,
    installPackage: entry.installPackage,
    status,
    detail,
    category: entry.category,
  };
}

async function checkClaudeStatus(): Promise<CliStatus> {
  const entry = CLI_BY_ID.get("claude")!;
  if (!commandExists("claude")) return catalogToStatus(entry, false, null, "not_installed", null);
  const version = commandVersion("claude");
  const creds = readCreds();
  if (creds.anthropic_api_key?.trim() || process.env.ANTHROPIC_API_KEY?.trim())
    return catalogToStatus(entry, true, version, "api_key_set", "ANTHROPIC_API_KEY is configured.");
  const authCheck = run("claude", ["auth", "status"], runtimeEnv());
  if (authCheck.ok || /logged in|authenticated/i.test(authCheck.stdout + authCheck.stderr))
    return catalogToStatus(entry, true, version, "authenticated", authCheck.stdout || null);
  return catalogToStatus(entry, true, version, "unauthenticated", "No API key or subscription login found.");
}

async function checkGhStatus(): Promise<CliStatus> {
  const entry = CLI_BY_ID.get("gh")!;
  if (!commandExists("gh")) return catalogToStatus(entry, false, null, "not_installed", null);
  const version = commandVersion("gh");
  const creds = readCreds();
  const ghEnv = runtimeEnv({ GH_HOME: process.env.GH_HOME ?? "/usr/local/share/gh" });
  const authResult = run("gh", ["auth", "status"], ghEnv);
  if (authResult.ok || /logged in|authenticated/i.test(authResult.stdout + authResult.stderr))
    return catalogToStatus(entry, true, version, "authenticated", authResult.stdout || authResult.stderr || null);
  if (creds.github_token?.trim() || process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim())
    return catalogToStatus(entry, true, version, "api_key_set", "GITHUB_TOKEN is set but gh may not be logged in.");
  // Don't surface the raw "gh auth login" error — show an actionable message instead.
  return catalogToStatus(entry, true, version, "unauthenticated",
    "Not logged in to GitHub. Use OAuth login or enter a Personal Access Token below.");
}

async function checkGeminiStatus(): Promise<CliStatus> {
  const entry = CLI_BY_ID.get("gemini")!;
  if (!commandExists("gemini")) return catalogToStatus(entry, false, null, "not_installed", null);
  const version = commandVersion("gemini");
  const creds = readCreds();
  if (creds.gemini_api_key?.trim() || creds.google_api_key?.trim() ||
    process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim())
    return catalogToStatus(entry, true, version, "api_key_set", "API key is configured.");
  const authResult = run("gemini", ["auth", "status"], runtimeEnv());
  if (authResult.ok || /logged in|authenticated/i.test(authResult.stdout + authResult.stderr))
    return catalogToStatus(entry, true, version, "authenticated", authResult.stdout || null);
  return catalogToStatus(entry, true, version, "unauthenticated", "No API key or login found.");
}

async function checkCodexStatus(): Promise<CliStatus> {
  const entry = CLI_BY_ID.get("codex")!;
  if (!commandExists("codex")) return catalogToStatus(entry, false, null, "not_installed", null);
  const version = commandVersion("codex");
  const creds = readCreds();
  if (creds.openai_api_key?.trim() || process.env.OPENAI_API_KEY?.trim())
    return catalogToStatus(entry, true, version, "api_key_set", "OPENAI_API_KEY is configured.");
  const home = process.env.HOME ?? "/root";
  const codexAuth = path.join(home, ".codex", "auth.json");
  if (fs.existsSync(codexAuth)) {
    try {
      const data = JSON.parse(fs.readFileSync(codexAuth, "utf8")) as Record<string, unknown>;
      const email = typeof data.email === "string" ? data.email : null;
      return catalogToStatus(entry, true, version, "authenticated", email ? `Logged in as ${email}` : "Native auth found.");
    } catch { /* malformed */ }
  }
  return catalogToStatus(entry, true, version, "unauthenticated", "No API key found.");
}

async function checkOpenCodeStatus(): Promise<CliStatus> {
  const entry = CLI_BY_ID.get("opencode")!;
  if (!commandExists("opencode")) return catalogToStatus(entry, false, null, "not_installed", null);
  const version = commandVersion("opencode");
  const creds = readCreds();

  // Any stored credential counts as configured — opencode picks up whichever
  // provider key is available at runtime (Anthropic, OpenAI, Gemini, Google,
  // OpenRouter, or GitHub Copilot via GITHUB_TOKEN).
  const anyStoredKey =
    creds.opencode_api_key?.trim() ||
    creds.anthropic_api_key?.trim() ||
    creds.openai_api_key?.trim() ||
    creds.gemini_api_key?.trim() ||
    creds.google_api_key?.trim() ||
    creds.github_token?.trim();

  const anyEnvKey =
    process.env.ANTHROPIC_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    process.env.OPENROUTER_API_KEY?.trim() ||
    process.env.GITHUB_TOKEN?.trim() ||
    process.env.GH_TOKEN?.trim();

  if (anyStoredKey || anyEnvKey)
    return catalogToStatus(entry, true, version, "api_key_set", "At least one provider API key is configured.");

  // Fall back: check opencode's own config file for provider entries.
  const configDirs = [
    process.env.XDG_CONFIG_HOME,
    path.join(process.env.HOME ?? "/root", ".config"),
  ].filter(Boolean) as string[];
  const hasConfigFile = configDirs.some((dir) => {
    const f = path.join(dir, "opencode", "config.json");
    try {
      const raw = fs.readFileSync(f, "utf8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // Any non-empty providers section counts as configured.
      return parsed.providers && typeof parsed.providers === "object" &&
        Object.keys(parsed.providers as object).length > 0;
    } catch { return false; }
  });
  if (hasConfigFile)
    return catalogToStatus(entry, true, version, "api_key_set", "Configured via opencode config file.");

  return catalogToStatus(entry, true, version, "unauthenticated", "No provider API keys configured.");
}

async function checkSimpleStatus(id: string, keyEnvVars: string[]): Promise<CliStatus> {
  const entry = CLI_BY_ID.get(id)!;
  if (!commandExists(entry.binary)) return catalogToStatus(entry, false, null, "not_installed", null);
  const version = commandVersion(entry.binary);
  const creds = readCreds() as Record<string, string | undefined>;
  const anyKey = keyEnvVars.some(
    (k) => !!(creds[k.toLowerCase()]?.trim()) || !!(process.env[k]?.trim())
  );
  if (anyKey) return catalogToStatus(entry, true, version, "api_key_set", "API key is configured.");
  return catalogToStatus(entry, true, version, "unauthenticated", null);
}

async function checkAllStatus(): Promise<CliStatus[]> {
  const [claude, gh, gemini, codex, opencode, aider, goose, llm] = await Promise.all([
    checkClaudeStatus(),
    checkGhStatus(),
    checkGeminiStatus(),
    checkCodexStatus(),
    checkOpenCodeStatus(),
    checkSimpleStatus("aider", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]),
    checkSimpleStatus("goose", ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"]),
    checkSimpleStatus("llm", ["OPENAI_API_KEY"]),
  ]);
  return [claude, gh, gemini, codex, opencode, aider, goose, llm];
}

// ─── GitHub Device Flow ───────────────────────────────────────────────────────

const GH_DEVICE_CLIENT_ID = "178c6fc778ccc68e1d6a";
const GH_DEVICE_SCOPE = "repo,read:org,gist";

interface GhDeviceCodeResponse {
  device_code: string; user_code: string; verification_uri: string;
  expires_in: number; interval: number;
}
interface GhDeviceTokenResponse {
  access_token?: string; token_type?: string; scope?: string;
  error?: string; error_description?: string;
}

async function startGhDeviceFlow(): Promise<GhDeviceCodeResponse> {
  const res = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GH_DEVICE_CLIENT_ID, scope: GH_DEVICE_SCOPE }),
  });
  if (!res.ok) throw new Error(`GitHub device flow failed: ${res.status}`);
  return res.json() as Promise<GhDeviceCodeResponse>;
}

async function pollGhDeviceFlow(deviceCode: string): Promise<GhDeviceTokenResponse> {
  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: GH_DEVICE_CLIENT_ID, device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  if (!res.ok) throw new Error(`GitHub token poll failed: ${res.status}`);
  return res.json() as Promise<GhDeviceTokenResponse>;
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

function assertAdmin(req: Request) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) return;
  throw forbidden("Instance admin access required");
}

// ─── Key mapping ─────────────────────────────────────────────────────────────

const CLI_KEY_MAP: Record<string, keyof CliCredentials> = {
  claude: "anthropic_api_key",
  codex: "openai_api_key",
  gemini: "gemini_api_key",
  opencode: "opencode_api_key",
  gh: "github_token",
  aider: "openai_api_key",
  goose: "openai_api_key",
  llm: "openai_api_key",
};

// ─── Install helpers ──────────────────────────────────────────────────────────

type SseEmit = (event: string, data: string) => void;

async function installViaNpm(pkg: string, emit: SseEmit): Promise<boolean> {
  return new Promise((resolve) => {
    const npmBin = process.env.npm_execpath ?? "npm";
    const child = spawn(npmBin, ["install", "--global", "--omit=dev", pkg], {
      env: runtimeEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
    child.stderr?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
    child.on("close", (code) => resolve(code === 0));
    child.on("error", (err) => { emit("log", `spawn error: ${err.message}`); resolve(false); });
  });
}

async function installViaPip(pkg: string, postCmds: Array<{ cmd: string; args: string[] }>, emit: SseEmit): Promise<boolean> {
  const ok = await new Promise<boolean>((resolve) => {
    const child = spawn("pip", ["install", "--quiet", pkg], {
      env: runtimeEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
    child.stderr?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
    child.on("close", (code) => resolve(code === 0));
    child.on("error", (err) => { emit("log", `spawn error: ${err.message}`); resolve(false); });
  });
  if (!ok) return false;
  for (const { cmd, args } of postCmds) {
    const postOk = await new Promise<boolean>((resolve) => {
      const child = spawn(cmd, args, { env: runtimeEnv(), stdio: ["ignore", "pipe", "pipe"] });
      child.stdout?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
      child.stderr?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
      child.on("close", (code) => resolve(code === 0));
      child.on("error", (err) => { emit("log", `post-install error: ${err.message}`); resolve(false); });
    });
    if (!postOk) return false;
  }
  return true;
}

async function installViaCurl(tarUrl: string, binary: string, emit: SseEmit): Promise<boolean> {
  // Download → extract → move to /usr/local/bin
  const tmpDir = `/tmp/install-${binary}-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });
  const tarFile = path.join(tmpDir, "tool.tar.gz");

  const dlOk = await new Promise<boolean>((resolve) => {
    const child = spawn("curl", ["-fsSL", "-o", tarFile, tarUrl], {
      env: runtimeEnv(), stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
    child.stderr?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
    child.on("close", (code) => resolve(code === 0));
    child.on("error", (err) => { emit("log", `curl error: ${err.message}`); resolve(false); });
  });
  if (!dlOk) return false;

  const extractOk = await new Promise<boolean>((resolve) => {
    const child = spawn("tar", ["-xzf", tarFile, "-C", tmpDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
  if (!extractOk) { emit("log", "tar extraction failed"); return false; }

  // Find binary in extracted dir
  const extracted = fs.readdirSync(tmpDir).filter((f) => f !== "tool.tar.gz");
  const binaryPath = extracted.map((f) => path.join(tmpDir, f, binary)).find((p) => fs.existsSync(p))
    ?? extracted.map((f) => path.join(tmpDir, f)).find((p) => fs.existsSync(p) && path.basename(p) === binary);
  if (!binaryPath) { emit("log", `Could not find binary '${binary}' in archive`); return false; }

  const dest = `/usr/local/bin/${binary}`;
  try {
    fs.copyFileSync(binaryPath, dest);
    fs.chmodSync(dest, 0o755);
    emit("log", `Installed to ${dest}`);
    return true;
  } catch (err) {
    emit("log", `Failed to copy to ${dest}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function cliCredentialsRoutes() {
  const router = Router();

  /** GET /instance/cli-credentials/status */
  router.get("/instance/cli-credentials/status", async (req, res) => {
    assertAdmin(req);
    res.json({ clis: await checkAllStatus() });
  });

  /** GET /instance/cli-credentials/catalog */
  router.get("/instance/cli-credentials/catalog", (req, res) => {
    assertAdmin(req);
    res.json({ catalog: CLI_CATALOG });
  });

  /**
   * GET /instance/cli-credentials/:cli/install
   * Server-Sent Events stream. Events:
   *   log  — raw stdout/stderr line
   *   done — { ok: boolean, message: string }
   */
  router.get("/instance/cli-credentials/:cli/install", async (req, res) => {
    assertAdmin(req);
    const { cli } = req.params;
    const entry = CLI_BY_ID.get(cli);
    if (!entry) { res.status(400).json({ error: `Unknown CLI: ${cli}` }); return; }
    if (entry.installMethod === "system") {
      res.status(400).json({ error: `${cli} must be installed via the system package manager (already bundled in Docker).` });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const emit: SseEmit = (event, data) => {
      res.write(`event: ${event}\ndata: ${data}\n\n`);
    };

    let ok = false;
    try {
      if (entry.installMethod === "npm" && entry.installPackage) {
        emit("log", `Installing ${entry.installPackage} via npm…`);
        ok = await installViaNpm(entry.installPackage, emit);
        // Claude Code has a post-install script
        if (ok && cli === "claude") {
          emit("log", "Running Claude post-install script…");
          const npmRoot = run("npm", ["root", "-g"]);
          const installScript = path.join(npmRoot.stdout, "@anthropic-ai/claude-code/install.cjs");
          if (fs.existsSync(installScript)) {
            const scriptOk = await new Promise<boolean>((resolve) => {
              const child = spawn("node", [installScript], { env: runtimeEnv(), stdio: ["ignore", "pipe", "pipe"] });
              child.stdout?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
              child.stderr?.on("data", (d: Buffer) => emit("log", d.toString().replace(/\n/g, "\\n")));
              child.on("close", (code) => resolve(code === 0));
              child.on("error", () => resolve(false));
            });
            if (!scriptOk) emit("log", "Warning: post-install script failed (non-fatal).");
          }
        }
      } else if (entry.installMethod === "pip" && entry.installPackage) {
        emit("log", `Installing ${entry.installPackage} via pip…`);
        ok = await installViaPip(entry.installPackage, entry.postInstallCmds ?? [], emit);
      } else if (entry.installMethod === "curl" && entry.installPackage) {
        emit("log", `Downloading ${entry.label} binary…`);
        ok = await installViaCurl(entry.installPackage, entry.binary, emit);
      } else {
        emit("log", `No install method for ${cli}.`);
      }
    } catch (err) {
      emit("log", `Install error: ${err instanceof Error ? err.message : String(err)}`);
      ok = false;
    }

    emit("done", JSON.stringify({ ok, message: ok ? `${entry.label} installed successfully.` : `Install failed — check logs above.` }));
    res.end();
  });

  /** POST /instance/cli-credentials/:cli/api-key */
  router.post("/instance/cli-credentials/:cli/api-key", async (req, res) => {
    assertAdmin(req);
    const { cli } = req.params;
    const credKey = CLI_KEY_MAP[cli];
    if (!credKey) { res.status(400).json({ error: `Unknown CLI: ${cli}` }); return; }
    const body = req.body as { key?: unknown };
    const key = typeof body.key === "string" ? body.key.trim() : "";
    if (!key) { res.status(400).json({ error: "key is required" }); return; }
    const creds = readCreds();
    creds[credKey] = key;
    writeCreds(creds);
    if (cli === "gh" && commandExists("gh")) {
      run("gh", ["auth", "login", "--with-token"],
        runtimeEnv({ GH_HOME: process.env.GH_HOME ?? "/usr/local/share/gh" }), key);
    }
    res.json({ ok: true });
  });

  /** DELETE /instance/cli-credentials/:cli/api-key */
  router.delete("/instance/cli-credentials/:cli/api-key", async (req, res) => {
    assertAdmin(req);
    const { cli } = req.params;
    const credKey = CLI_KEY_MAP[cli];
    if (!credKey) { res.status(400).json({ error: `Unknown CLI: ${cli}` }); return; }
    const creds = readCreds();
    delete creds[credKey];
    writeCreds(creds);
    if (cli === "gh" && commandExists("gh")) {
      run("gh", ["auth", "logout", "--hostname", "github.com"],
        runtimeEnv({ GH_HOME: process.env.GH_HOME ?? "/usr/local/share/gh" }));
    }
    res.status(204).send();
  });

  /** POST /instance/cli-credentials/gh/device-flow/start */
  router.post("/instance/cli-credentials/gh/device-flow/start", async (req, res) => {
    assertAdmin(req);
    try { res.json(await startGhDeviceFlow()); }
    catch (err) { res.status(502).json({ error: err instanceof Error ? err.message : "Device flow failed" }); }
  });

  /** POST /instance/cli-credentials/gh/device-flow/poll */
  router.post("/instance/cli-credentials/gh/device-flow/poll", async (req, res) => {
    assertAdmin(req);
    const body = req.body as { device_code?: unknown };
    const deviceCode = typeof body.device_code === "string" ? body.device_code.trim() : "";
    if (!deviceCode) { res.status(400).json({ error: "device_code is required" }); return; }
    try {
      const data = await pollGhDeviceFlow(deviceCode);
      if (data.access_token) {
        const creds = readCreds();
        creds.github_token = data.access_token;
        writeCreds(creds);
        if (commandExists("gh")) {
          run("gh", ["auth", "login", "--with-token"],
            runtimeEnv({ GH_HOME: process.env.GH_HOME ?? "/usr/local/share/gh" }),
            data.access_token);
        }
      }
      res.json(data);
    } catch (err) {
      res.status(502).json({ error: err instanceof Error ? err.message : "Poll failed" });
    }
  });

  return router;
}
