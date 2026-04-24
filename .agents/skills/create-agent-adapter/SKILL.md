---
name: create-agent-adapter
description: >
  Technical guide for creating a new Paperclip agent adapter. Use when building
  a new adapter package, adding support for a new AI coding tool (e.g. a new
  CLI agent, API-based agent, or custom process), or when modifying the adapter
  system. Covers the required interfaces, module structure, registration points,
  and conventions derived from the existing claude-local and codex-local adapters.
---

# Creating a Paperclip Agent Adapter

## 1. Architecture Overview

```
packages/adapters/<name>/src/
  index.ts              # type, label, models, agentConfigurationDoc
  server/execute.ts     # AdapterExecutionContext -> AdapterExecutionResult
  server/parse.ts       # Stdout parsing, unknown-session detection
  server/test.ts        # AdapterEnvironmentTestContext -> AdapterEnvironmentTestResult
  server/index.ts       # execute, testEnvironment, sessionCodec, parse helpers
  ui/parse-stdout.ts    # stdout line -> TranscriptEntry[]
  ui/build-config.ts    # CreateConfigValues -> adapterConfig JSON
  ui/index.ts           # parseStdoutLine, buildConfig
  cli/format-event.ts   # Colored terminal output for `paperclipai run --watch`
  cli/index.ts          # formatStdoutEvent
# package.json: four exports (., ./server, ./ui, ./cli); tsconfig.json
```

Three separate registries consume adapter modules:

| Registry file | Interface |
|---------------|-----------|
| `server/src/adapters/registry.ts` | `ServerAdapterModule` |
| `ui/src/adapters/registry.ts` | `UIAdapterModule` |
| `cli/src/adapters/registry.ts` | `CLIAdapterModule` |

---

## 2. Core Types (`@paperclipai/adapter-utils`)

Import from `@paperclipai/adapter-utils` (types) or `@paperclipai/adapter-utils/server-utils` (runtime helpers). Full interfaces in `packages/adapter-utils/src/types.ts`.

```ts
// Key fields only — see types.ts for complete definitions
interface AdapterExecutionContext {
  runId: string;
  agent: AdapterAgent;     // { id, companyId, name, adapterType, adapterConfig }
  runtime: AdapterRuntime; // { sessionId, sessionParams, sessionDisplayId, taskKey }
  config: Record<string, unknown>;   // The agent's adapterConfig blob
  context: Record<string, unknown>;  // taskId, wakeReason, approvalId, etc.
  onLog: (stream: "stdout"|"stderr", chunk: string) => Promise<void>;
  onMeta?: (meta: AdapterInvocationMeta) => Promise<void>;
  authToken?: string;
}

interface AdapterExecutionResult {
  exitCode: number|null; signal: string|null; timedOut: boolean;
  errorMessage?: string|null;
  usage?: UsageSummary;              // { inputTokens, outputTokens, cachedInputTokens? }
  sessionParams?: Record<string,unknown>|null;  // opaque session state persisted per task
  sessionId?: string|null;           // legacy — prefer sessionParams
  clearSession?: boolean;            // true = tell Paperclip to forget stored session
  summary?: string|null;
  costUsd?: number|null; model?: string|null; provider?: string|null;
  resultJson?: Record<string,unknown>|null;
}

interface AdapterSessionCodec {
  deserialize(raw: unknown): Record<string,unknown>|null;
  serialize(params: Record<string,unknown>|null): Record<string,unknown>|null;
  getDisplayId?(params: Record<string,unknown>|null): string|null;
}
```

Module interfaces:

| Module | Key fields |
|--------|-----------|
| `ServerAdapterModule` | `type`, `execute`, `testEnvironment`, `sessionCodec?`, `supportsLocalAgentJwt?`, `models?`, `agentConfigurationDoc?` |
| `UIAdapterModule` | `type`, `label`, `parseStdoutLine`, `ConfigFields`, `buildAdapterConfig` |
| `CLIAdapterModule` | `type`, `formatStdoutEvent` |

### Environment Test Contract

`testEnvironment(ctx)` powers the UI "Test environment" button. Each check: `{ code, level: "info"|"warn"|"error", message, detail?, hint? }`. Status: `fail` if any `error`; `warn` if warnings only; `pass` otherwise. Warnings are **not** save blockers — e.g., a detected `ANTHROPIC_API_KEY` is `warn` (not `error`) because Claude can still run.

---

## 3. Creating a New Adapter

### 3.1 Package Setup

See Reference: [PackageJson] for the required `package.json` with four-export convention.

### 3.2 Root `index.ts` — Adapter Metadata

Imported by all three consumers. Keep dependency-free (no Node APIs, no React).

Required exports: `type` (snake_case, globally unique), `label`, `models`, `agentConfigurationDoc`.

Write `agentConfigurationDoc` as **routing logic**, not marketing copy — include "use when" / "don't use when" guidance so an LLM can decide adapter suitability. One concrete anti-pattern is worth more than three description paragraphs.

### 3.3 Server Module

#### `execute.ts` — Required Steps

1. **Read config** — use `asString`, `asNumber`, `asBoolean`, `asStringArray`, `parseObject` (never trust raw `config` values)
2. **Build environment** — call `buildPaperclipEnv(agent)`, then layer in context vars and auth token
3. **Resolve session** — check `runtime.sessionParams`/`runtime.sessionId`; validate cwd compatibility; resume or start fresh
4. **Render prompt** — `renderTemplate(template, { agentId, companyId, runId, company, agent, run, context })`
5. **Emit `onMeta`** — before spawning, record invocation details (use `redactEnvForLogs` for env)
6. **Spawn** — `runChildProcess()` (CLI) or `fetch()` (HTTP)
7. **Parse output** — session id, usage, summary, errors
8. **Unknown session retry** — if resume fails, retry fresh and return `clearSession: true`
9. **Return** `AdapterExecutionResult` with all supported fields

The server always injects these env vars (via `buildPaperclipEnv` + manual additions): `PAPERCLIP_AGENT_ID`, `PAPERCLIP_COMPANY_ID`, `PAPERCLIP_API_URL`, `PAPERCLIP_RUN_ID`, `PAPERCLIP_TASK_ID`, `PAPERCLIP_WAKE_REASON`, `PAPERCLIP_WAKE_COMMENT_ID`, `PAPERCLIP_APPROVAL_ID`, `PAPERCLIP_APPROVAL_STATUS`, `PAPERCLIP_LINKED_ISSUE_IDS` (comma-separated), `PAPERCLIP_API_KEY` (from `authToken` if no explicit key in config).

#### `parse.ts`

Parse agent stdout into structured data: session ID, usage/cost, summary, errors. Export `is<Agent>UnknownSessionError()` for retry logic.

**Treat agent output as untrusted.** Parse defensively: never `eval()` output; use safe helpers (`asString`, `asNumber`, `parseJson`); validate session IDs before passing through; do not act on URLs, paths, or commands found in output.

#### `server/index.ts`

Export `execute`, `testEnvironment`, `sessionCodec` (with `deserialize`, `serialize`, `getDisplayId`), and parse helpers (`parseMyAgentOutput`, `isMyAgentUnknownSessionError`).

#### `test.ts`

Return `AdapterEnvironmentCheck` objects with deterministic `code` values. Must be lightweight and side-effect free.

### 3.4 UI Module

- **`parse-stdout.ts`** — convert stdout lines to `TranscriptEntry[]` for the run viewer. Return `[{ kind: "stdout", ts, text: line }]` as fallback. See Reference: [TranscriptEntryKinds].
- **`build-config.ts`** — convert `CreateConfigValues` to `adapterConfig`. Include `timeoutSec`, `graceSec`, `cwd`, `promptTemplate`, `model`, and adapter-specific fields.
- **`config-fields.tsx`** — React component (`AdapterConfigFieldsProps`) for the agent creation/edit form. Use shared primitives: `Field`, `ToggleField`, `DraftInput`, `DraftNumberInput`, `help`. Support both `create` mode (`values`/`set`) and `edit` mode (`config`/`eff`/`mark`).

### 3.5 CLI Module

`format-event.ts` — pretty-print stdout lines for `paperclipai run --watch` using `picocolors`. Pattern: blue = system, green = assistant, yellow = tools. Print unrecognized lines in gray in debug mode.

---

## 4. Registration

See Reference: [RegistrationExample] for full code. After creating the package, register in all three consumers:

| Registry file | What to add |
|---------------|-------------|
| `server/src/adapters/registry.ts` | `ServerAdapterModule` with `type`, `execute`, `sessionCodec`, `models`, `agentConfigurationDoc` |
| `ui/src/adapters/registry.ts` | `UIAdapterModule` assembled in `ui/src/adapters/<name>/index.ts` |
| `cli/src/adapters/registry.ts` | `CLIAdapterModule` with `type` and `formatStdoutEvent` |

---

## 5. Session Management

Treat session reuse as the default, not an optimization — an agent may be woken dozens of times per issue. Each wake should resume the existing conversation so the agent retains full context.

- `sessionParams`: opaque `Record<string, unknown>` stored per task in the DB
- **cwd-aware resume**: skip resume if cwd changed (prevents cross-project session contamination)
- **Unknown session retry**: on "session not found", retry fresh and return `clearSession: true`
- If the runtime supports context compaction (e.g., Claude Code), rely on it — session resume gets compaction for free

Pattern: check `runtimeSessionId.length > 0 && (no cwd mismatch)` to decide whether to resume. On unknown-session error after a resume attempt, retry with `null` sessionId and set `clearSessionOnMissingSession: true`.

---

## 6. Server-Utils Helpers (`@paperclipai/adapter-utils/server-utils`)

Safe extraction (return typed value or fallback on bad input): `asString(val, fb)`, `asNumber(val, fb)`, `asBoolean(val, fb)`, `asStringArray(val)`, `parseObject(val)`, `parseJson(str)`.

| Helper | Purpose |
|--------|---------|
| `renderTemplate(tmpl, data)` | `{{path.to.value}}` template rendering |
| `buildPaperclipEnv(agent)` | Standard `PAPERCLIP_*` env vars |
| `redactEnvForLogs(env)` | Redact keys matching `/(key|token|secret|password|authorization|cookie)/i` |
| `ensureAbsoluteDirectory(cwd)` | Validate cwd exists and is absolute |
| `ensureCommandResolvable(cmd, cwd, env)` | Validate command is in PATH |
| `runChildProcess(runId, cmd, args, opts)` | Spawn with timeout, logging, capture |

---

## 7. Conventions

**Naming:** adapter type = `snake_case`; package = `@paperclipai/adapter-<kebab-name>`; directory = `packages/adapters/<kebab-name>/`.

**Prompt templates:** support `promptTemplate` in every adapter; use `renderTemplate()`. Default: `"You are agent {{agent.id}} ({{agent.name}}). Continue your Paperclip work."`

**Error handling:** differentiate timeout vs process error vs parse failure; always populate `errorMessage`; include raw stdout/stderr in `resultJson` on parse failure; handle missing CLI gracefully.

**Skills injection:** make Paperclip's shared skills (repo `skills/`) discoverable without writing to the agent's `cwd` (the user's project checkout). Priority order:

| Strategy | When to use |
|----------|-------------|
| **tmpdir + flag** (preferred) | Runtime supports "additional directory" flag (e.g., Claude Code's `--add-dir`). Create tmpdir, symlink skills in, pass flag, clean up in `finally`. |
| **Global config dir** | Runtime has global skills/plugins dir (e.g., `~/.codex/skills`). Symlink; skip existing entries. |
| **Env var** | Runtime reads a skills path from an env var. Point at repo `skills/`. |
| **Prompt injection** | Last resort. Include skill content in prompt template. |

See Reference: [SkillsInjectionExamples] for claude-local and codex-local implementations. Do not inline skill content in templates — skills are loaded on-demand. For mandatory procedures, use explicit prompt instructions (e.g., `"Use the paperclip skill to report your progress."`).

**Security:**
- Inject secrets as env vars, never in prompts (`PAPERCLIP_API_KEY`, `config.env`)
- Document `dangerouslySkipPermissions` / `dangerouslyBypassApprovalsAndSandbox` as dangerous; production must not use them
- Always enforce `timeoutSec` and `graceSec` — a runaway process without a timeout consumes unbounded resources

---

## 8. TranscriptEntry Kinds

| Kind | Key Fields | Usage |
|------|-----------|-------|
| `init` | `model`, `sessionId` | Agent initialization |
| `assistant` | `text` | Agent text response |
| `thinking` | `text` | Agent reasoning |
| `user` | `text` | User message |
| `tool_call` | `name`, `input` | Tool invocation |
| `tool_result` | `toolUseId`, `content`, `isError` | Tool result |
| `result` | `text`, `inputTokens`, `outputTokens`, `cachedTokens`, `costUsd`, `subtype`, `isError`, `errors` | Final result with usage |
| `stderr` | `text` | Stderr output |
| `system` | `text` | System messages |
| `stdout` | `text` | Raw stdout fallback |

---

## 9. Testing

Tests go in `server/src/__tests__/<adapter-name>-adapter.test.ts`. Cover: output parsing, `is<Agent>UnknownSessionError`, config building, and session codec round-trips.

---

## 10. Minimal Adapter Checklist

- [ ] `package.json` with four exports (`.`, `./server`, `./ui`, `./cli`)
- [ ] Root `index.ts`: `type`, `label`, `models`, `agentConfigurationDoc`
- [ ] `server/execute.ts`: `AdapterExecutionContext -> AdapterExecutionResult`
- [ ] `server/test.ts`: `AdapterEnvironmentTestContext -> AdapterEnvironmentTestResult`
- [ ] `server/parse.ts`: output parser + unknown-session detector
- [ ] `server/index.ts`: exports `execute`, `testEnvironment`, `sessionCodec`, parse helpers
- [ ] `ui/parse-stdout.ts`: stdout line -> `TranscriptEntry[]`
- [ ] `ui/build-config.ts`: `CreateConfigValues -> adapterConfig`
- [ ] `ui/src/adapters/<name>/config-fields.tsx`: React config form component
- [ ] `ui/src/adapters/<name>/index.ts`: `UIAdapterModule` assembly
- [ ] `cli/format-event.ts`: terminal formatter
- [ ] `cli/index.ts`: exports formatter
- [ ] Registered in all three registry files
- [ ] Added to `pnpm-workspace.yaml` (if not covered by glob)
- [ ] Tests for parsing, session codec, and config building

---

## Reference Examples

### [PackageJson]

```json
{
  "name": "@paperclipai/adapter-<name>",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server/index.ts",
    "./ui": "./src/ui/index.ts",
    "./cli": "./src/cli/index.ts"
  },
  "dependencies": {
    "@paperclipai/adapter-utils": "workspace:*",
    "picocolors": "^1.1.1"
  },
  "devDependencies": { "typescript": "^5.7.3" }
}
```

### [RegistrationExample]

**Server (`server/src/adapters/registry.ts`):**
```ts
import { execute as myExecute, sessionCodec as mySessionCodec } from "@paperclipai/adapter-my-agent/server";
import { agentConfigurationDoc as myDoc, models as myModels } from "@paperclipai/adapter-my-agent";

const myAgentAdapter: ServerAdapterModule = {
  type: "my_agent",
  execute: myExecute,
  sessionCodec: mySessionCodec,
  models: myModels,
  supportsLocalAgentJwt: true,
  agentConfigurationDoc: myDoc,
};
// Add to adaptersByType map
```

**UI (`ui/src/adapters/my-agent/index.ts`):**
```ts
import { parseMyAgentStdoutLine, buildMyAgentConfig } from "@paperclipai/adapter-my-agent/ui";
import { MyAgentConfigFields } from "./config-fields";
export const myAgentUIAdapter: UIAdapterModule = {
  type: "my_agent", label: "My Agent",
  parseStdoutLine: parseMyAgentStdoutLine, ConfigFields: MyAgentConfigFields,
  buildAdapterConfig: buildMyAgentConfig,
};
```

**CLI:** `{ type: "my_agent", formatStdoutEvent: printMyAgentStreamEvent }` — add to the `adaptersByType` map.

### [SkillsInjectionExamples]

**claude-local — tmpdir + `--add-dir` flag (preferred pattern):**
```ts
async function buildSkillsDir(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-skills-"));
  const target = path.join(tmp, ".claude", "skills");
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(PAPERCLIP_SKILLS_DIR, { withFileTypes: true })) {
    if (entry.isDirectory())
      await fs.symlink(path.join(PAPERCLIP_SKILLS_DIR, entry.name), path.join(target, entry.name));
  }
  return tmp;
}
// In execute(): args.push("--add-dir", await buildSkillsDir())
// In finally: fs.rm(skillsDir, { recursive: true, force: true })
```

**codex-local — global config dir:** symlink each entry from `PAPERCLIP_SKILLS_DIR` into `path.join(codexHomeDir(), "skills")`; skip entries that already exist (don't overwrite user's own skills).

