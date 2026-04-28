# Paperclip Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce token consumption and improve agent output quality by implementing skill allowlists, compressing skill content, verifying Claude telemetry accuracy, and expanding the company export to cover memories, MCP config, and telemetry.

**Architecture:** Four parallel tracks — Track A fixes the skill injection pipeline so each agent only loads skills it opted into (default: paperclip only). Track B rewrites skill Markdown to remove redundancy and scaffolding prose. Track C verifies whether Claude CLI reports cumulative or per-run tokens and fixes the delta logic if needed. Track D expands the company portability export to include agent memories and telemetry data.

**Tech Stack:** TypeScript (NodeNext, strict), Drizzle ORM, Vitest, Express 5, Zod, pnpm workspaces

---

## File Map

| File | Role |
|------|------|
| `packages/adapter-utils/src/server-utils.ts` | Skill resolution utilities — required/desired logic |
| `server/src/services/company-skills.ts` | Skill DB layer — `listRuntimeSkillEntries` |
| `server/src/__tests__/claude-local-skill-sync.test.ts` | Claude skill injection tests |
| `packages/adapters/claude-local/src/server/execute.ts` | Claude run executor — telemetry reading |
| `server/src/services/heartbeat.ts` | Heartbeat orchestration — telemetry delta |
| `packages/shared/src/types/company-portability.ts` | Portability types |
| `packages/shared/src/validators/company-portability.ts` | Portability Zod validators |
| `server/src/services/portability.ts` | Export bundle assembly |
| `skills/paperclip/SKILL.md` | Core heartbeat skill |
| `skills/paperclip/references/api-reference.md` | API reference |
| `skills/paperclip/references/company-skills.md` | Company skills reference |
| `.agents/skills/create-agent-adapter/SKILL.md` | Adapter creation skill |
| `skills/para-memory-files/SKILL.md` | Memory management skill |
| `skills/paperclip-create-agent/SKILL.md` | Agent creation skill |

---

## Track C — Telemetry Verification (first — read-only)

### Task 1: Verify Claude token reporting mode

**Files:**
- Read only: live PGlite DB via `pnpm dev:server` + curl

- [ ] **Step 1: Start the dev server**

```bash
pnpm dev:server &
sleep 3
```

Expected: server starts at `http://localhost:3100`

- [ ] **Step 2: Query consecutive Claude runs in the same session**

Using the Paperclip dashboard or a direct DB query via the API, look for Claude runs where `sessionIdBefore === sessionIdAfter` (resumed sessions). Compare `rawInputTokens` across runs in the same session.

Run against the PGlite DB file at `~/.paperclip/instances/default/db/`:

```bash
# Check the heartbeat_runs table via the Paperclip server
curl -s -H "Authorization: Bearer $BOARD_TOKEN" \
  "http://localhost:3100/api/companies/$COMPANY_ID/heartbeat-runs?limit=50" | \
  jq '[.runs[] | select(.adapterType == "claude_local" and .sessionIdBefore != null and .sessionIdBefore == .sessionIdAfter) | {id, sessionIdBefore, sessionIdAfter, usageJson: (.usageJson // {})}] | .[0:10]'
```

- [ ] **Step 3: Analyze results**

Compare `rawInputTokens` across consecutive runs in the same session:

- **Monotonically increasing** → Claude CLI reports cumulative totals → delta logic is correct and working
- **Resets each run** → Claude CLI reports per-run totals → delta logic incorrectly subtracts (mark as `usageSource: "per_run"` to skip)
- **Zero or negative `normalizedInputTokens` when `rawInputTokens` is large** → bug in delta computation

Document the finding. If Claude reports per-run tokens, proceed to Step 4. If cumulative, Track C is complete — commit "docs: track C telemetry verified — claude reports cumulative session totals" and skip to Track A.

- [ ] **Step 4 (conditional): Set per-run flag in claude adapter**

If Claude CLI reports per-run tokens, add a flag to the execute result.

In `packages/adapters/claude-local/src/server/execute.ts`, find where usage is extracted (around line 560-567) and add `usageReportingMode: "per_run"` to the result:

```typescript
// After reading usage from finalResult:
const usageReportingMode = "per_run"; // Claude CLI reports tokens per-run, not cumulative
return {
  // ... existing fields ...
  usageReportingMode,
};
```

- [ ] **Step 5 (conditional): Skip delta in heartbeat for per-run adapters**

In `server/src/services/heartbeat.ts`, around line 2775 where `usageSource` is set, check the adapter's `usageReportingMode`:

```typescript
// Before applying deriveNormalizedUsageDelta:
const isPerRun = adapterResult.usageReportingMode === "per_run";
const sessionUsageResolution = isPerRun
  ? { normalized: rawUsage, derivedFromSessionTotals: false }
  : deriveNormalizedUsageDelta(rawUsage, previousUsage);

// In usageJson:
...(isPerRun ? { usageSource: "per_run" } : sessionUsageResolution.derivedFromSessionTotals ? { usageSource: "session_delta" } : {}),
```

- [ ] **Step 6 (conditional): Run tests and commit**

```bash
pnpm -r typecheck && pnpm test:run
git add packages/adapters/claude-local/src/server/execute.ts server/src/services/heartbeat.ts
git commit -m "fix: mark claude adapter as per-run token reporter to skip delta subtraction"
```

---

## Track A — Skill Allowlists

### Task 2: Make only the core paperclip skill required by default

**Files:**
- Modify: `packages/adapter-utils/src/server-utils.ts:366-387` (fallback path)
- Modify: `server/src/services/company-skills.ts:2036-2067` (heartbeat path)

**Root cause:** `listPaperclipSkillEntries` (fallback, no heartbeat config) marks ALL bundled skills `required: true`. `listRuntimeSkillEntries` (heartbeat path) marks ALL `paperclip_bundled` skills `required: true`. Both paths cause `para-memory-files`, `paperclip-create-agent`, and `paperclip-create-plugin` to be injected to every agent regardless of need.

- [ ] **Step 1: Write the failing test**

Add to `server/src/__tests__/claude-local-skill-sync.test.ts`, inside the `describe` block before the closing `}`:

```typescript
it("defaults to only the core paperclip skill when no explicit selection exists", async () => {
  const snapshot = await listClaudeSkills({
    agentId: "agent-1",
    companyId: "company-1",
    adapterType: "claude_local",
    config: {},
  });

  expect(snapshot.desiredSkills).toContain(paperclipKey);
  expect(snapshot.entries.find((e) => e.key === paperclipKey)?.state).toBe("configured");
  expect(snapshot.entries.find((e) => e.key === createAgentKey)?.state).toBe("available");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run server/src/__tests__/claude-local-skill-sync.test.ts -t "defaults to only the core paperclip skill"
```

Expected: FAIL — `createAgentKey` is currently "configured" (it's required), not "available".

- [ ] **Step 3: Fix `listPaperclipSkillEntries` in adapter-utils**

In `packages/adapter-utils/src/server-utils.ts`, find `listPaperclipSkillEntries` (around line 366) and change:

```typescript
// BEFORE:
.map((entry) => ({
  key: `paperclipai/paperclip/${entry.name}`,
  runtimeName: entry.name,
  source: path.join(root, entry.name),
  required: true,
  requiredReason: "Bundled Paperclip skills are always available for local adapters.",
}));

// AFTER:
.map((entry) => ({
  key: `paperclipai/paperclip/${entry.name}`,
  runtimeName: entry.name,
  source: path.join(root, entry.name),
  required: entry.name === "paperclip",
  requiredReason: entry.name === "paperclip"
    ? "The core Paperclip skill is required for all local adapters."
    : null,
}));
```

- [ ] **Step 4: Fix `listRuntimeSkillEntries` in company-skills.ts**

In `server/src/services/company-skills.ts`, find `listRuntimeSkillEntries` (around line 2053) and change:

```typescript
// BEFORE:
const required = sourceKind === "paperclip_bundled";

// AFTER:
const PAPERCLIP_CORE_KEY = "paperclipai/paperclip/paperclip";
const required = skill.key === PAPERCLIP_CORE_KEY;
```

- [ ] **Step 5: Run the new test**

```bash
pnpm vitest run server/src/__tests__/claude-local-skill-sync.test.ts -t "defaults to only the core paperclip skill"
```

Expected: PASS

- [ ] **Step 6: Update the now-stale existing test**

The test "defaults to mounting all built-in Paperclip skills when no explicit selection exists" (line 31) must be updated — it now describes the old behavior.

Change the test name and assertion:

```typescript
it("defaults to mounting only the core paperclip skill when no explicit selection exists", async () => {
  const snapshot = await listClaudeSkills({
    agentId: "agent-1",
    companyId: "company-1",
    adapterType: "claude_local",
    config: {},
  });

  expect(snapshot.mode).toBe("ephemeral");
  expect(snapshot.supported).toBe(true);
  expect(snapshot.desiredSkills).toContain(paperclipKey);
  expect(snapshot.desiredSkills).not.toContain(createAgentKey);
  expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.required).toBe(true);
  expect(snapshot.entries.find((entry) => entry.key === paperclipKey)?.state).toBe("configured");
  expect(snapshot.entries.find((entry) => entry.key === createAgentKey)?.required).toBe(false);
  expect(snapshot.entries.find((entry) => entry.key === createAgentKey)?.state).toBe("available");
});
```

Also update the test "respects an explicit desired skill list..." (line 46, assertion at line 60): `createAgentKey` is no longer required, so when only `paperclipKey` is in `desiredSkills`, `createAgentKey` should be "available" not "configured":

```typescript
// Change line 60 from:
expect(snapshot.entries.find((entry) => entry.key === createAgentKey)?.state).toBe("configured");
// To:
expect(snapshot.entries.find((entry) => entry.key === createAgentKey)?.state).toBe("available");
```

- [ ] **Step 7: Run all skill sync tests**

```bash
pnpm vitest run server/src/__tests__/claude-local-skill-sync.test.ts
pnpm vitest run server/src/__tests__/agent-skill-contract.test.ts
pnpm vitest run server/src/__tests__/company-skills.test.ts
```

Expected: all PASS

- [ ] **Step 8: Commit**

```bash
git add packages/adapter-utils/src/server-utils.ts server/src/services/company-skills.ts server/src/__tests__/claude-local-skill-sync.test.ts
git commit -m "feat: default to injecting only core paperclip skill — opt-in required for specialist skills"
```

---

### Task 3: Add wildcard support for "inject all" opt-in

**Files:**
- Modify: `packages/adapter-utils/src/server-utils.ts:598-613` (`resolvePaperclipDesiredSkillNames`)

Agents that want ALL skills can set `desiredSkills: ["*"]`. This expands to every available entry.

- [ ] **Step 1: Write the failing test**

Add to `server/src/__tests__/claude-local-skill-sync.test.ts`:

```typescript
it("expands '*' wildcard to all available skills", async () => {
  const snapshot = await listClaudeSkills({
    agentId: "agent-5",
    companyId: "company-1",
    adapterType: "claude_local",
    config: {
      paperclipSkillSync: {
        desiredSkills: ["*"],
      },
    },
  });

  expect(snapshot.desiredSkills).toContain(paperclipKey);
  expect(snapshot.desiredSkills).toContain(createAgentKey);
  expect(snapshot.entries.every((e) => e.state === "configured" || e.state === "external")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm vitest run server/src/__tests__/claude-local-skill-sync.test.ts -t "expands"
```

Expected: FAIL — `"*"` is treated as a literal string, not a wildcard.

- [ ] **Step 3: Add wildcard expansion to `resolvePaperclipDesiredSkillNames`**

In `packages/adapter-utils/src/server-utils.ts`, find `resolvePaperclipDesiredSkillNames` (around line 598) and change:

```typescript
// BEFORE:
export function resolvePaperclipDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string; runtimeName?: string | null; required?: boolean }>,
): string[] {
  const preference = readPaperclipSkillSyncPreference(config);
  const requiredSkills = availableEntries
    .filter((entry) => entry.required)
    .map((entry) => entry.key);
  if (!preference.explicit) {
    return Array.from(new Set(requiredSkills));
  }
  const desiredSkills = preference.desiredSkills
    .map((reference) => canonicalizeDesiredPaperclipSkillReference(reference, availableEntries))
    .filter(Boolean);
  return Array.from(new Set([...requiredSkills, ...desiredSkills]));
}

// AFTER:
export function resolvePaperclipDesiredSkillNames(
  config: Record<string, unknown>,
  availableEntries: Array<{ key: string; runtimeName?: string | null; required?: boolean }>,
): string[] {
  const preference = readPaperclipSkillSyncPreference(config);
  const requiredSkills = availableEntries
    .filter((entry) => entry.required)
    .map((entry) => entry.key);
  if (!preference.explicit) {
    return Array.from(new Set(requiredSkills));
  }
  if (preference.desiredSkills.includes("*")) {
    return Array.from(new Set([...requiredSkills, ...availableEntries.map((e) => e.key)]));
  }
  const desiredSkills = preference.desiredSkills
    .map((reference) => canonicalizeDesiredPaperclipSkillReference(reference, availableEntries))
    .filter(Boolean);
  return Array.from(new Set([...requiredSkills, ...desiredSkills]));
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run server/src/__tests__/claude-local-skill-sync.test.ts
```

Expected: all PASS including the new wildcard test.

- [ ] **Step 5: Commit**

```bash
git add packages/adapter-utils/src/server-utils.ts server/src/__tests__/claude-local-skill-sync.test.ts
git commit -m "feat: support '*' wildcard in desiredSkills to opt into all available skills"
```

---

### Task 4: Full typecheck and test suite after Track A

- [ ] **Step 1: Run full verification**

```bash
pnpm -r typecheck && pnpm test:run
```

Expected: all PASS. If any skill sync tests for other adapters (cursor, codex, gemini, pi) fail due to the `required: true` change, update their assertions the same way as the claude test — `createAgentKey`-equivalent entries should now be "available" by default, not "configured"/"installed".

- [ ] **Step 2: Check other adapter skill sync tests**

```bash
pnpm vitest run server/src/__tests__/cursor-local-skill-sync.test.ts
pnpm vitest run server/src/__tests__/codex-local-skill-injection.test.ts
pnpm vitest run server/src/__tests__/gemini-local-skill-sync.test.ts
pnpm vitest run server/src/__tests__/pi-local-skill-sync.test.ts
```

For each failing test: update the assertion that previously expected non-paperclip bundled skills to be "installed"/"configured"/"synced" by default, to instead expect "available"/"missing".

---

## Track B — Content Optimization

### Task 5: Rewrite `skills/paperclip/SKILL.md` (365 → ~250 lines)

**Rewrite principles for this file:**
1. Remove "Use this when..." and "The following section describes..." scaffolding sentences.
2. Compress inline examples — keep the API call shape (one code block per endpoint), remove repeated explanatory sentences before/after code blocks that restate what the code shows.
3. Keep all API paths, methods, and headers intact — they are functional, not decorative.
4. Consolidate the Heartbeat Procedure steps — eliminate mid-step prose that re-explains already-clear JSON shapes.
5. Tables over bullet lists where structure has ≥3 fields.

- [ ] **Step 1: Read the file**

```bash
wc -l skills/paperclip/SKILL.md
```

Verify current size is ~365 lines before editing.

- [ ] **Step 2: Apply rewrite**

Open `skills/paperclip/SKILL.md` and apply the following compressions:

**Authentication block (lines ~15-21):** Collapse into a single table for env vars rather than one long sentence:

```markdown
## Authentication

| Var | Description |
|-----|-------------|
| `PAPERCLIP_AGENT_ID` | Your agent identity |
| `PAPERCLIP_COMPANY_ID` | Your company scope |
| `PAPERCLIP_API_URL` | Base URL (never hard-code) |
| `PAPERCLIP_RUN_ID` | Current run ID — include in all mutation headers |
| `PAPERCLIP_API_KEY` | Bearer token (auto-injected for local adapters; set in config for non-local) |
| `PAPERCLIP_TASK_ID` | Task that triggered this wake (optional) |
| `PAPERCLIP_WAKE_REASON` | Why this run was triggered (optional) |
| `PAPERCLIP_WAKE_COMMENT_ID` | Specific triggering comment ID (optional) |
| `PAPERCLIP_APPROVAL_ID` | Pending approval ID (optional) |
| `PAPERCLIP_APPROVAL_STATUS` | Approval resolution status (optional) |
| `PAPERCLIP_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs (optional) |

All requests: `Authorization: Bearer $PAPERCLIP_API_KEY`, all JSON, base path `/api`.
Run audit trail: include `-H 'X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID'` on ALL issue mutations.
```

**Heartbeat Procedure:** Remove introductory sentences for each step — keep just the action and code blocks. Example of "before / after" for Step 1:

```markdown
# BEFORE (wordy):
**Step 1 — Identity.** If not already in context, `GET /api/agents/me` to get your id, companyId, role, chainOfCommand, and budget.

# AFTER (direct):
**Step 1 — Identity.** `GET /api/agents/me` → id, companyId, role, chainOfCommand, budget.
```

Apply this pattern throughout all 8 steps.

**Comment Style section:** Replace prose with a 2-column table showing format rules.

**Budget section:** Cut the explanatory sentences that repeat what the code shapes show.

- [ ] **Step 3: Verify size reduction**

```bash
wc -l skills/paperclip/SKILL.md
```

Target: ≤260 lines. If over target, identify the largest remaining prose block and compress it further.

- [ ] **Step 4: Commit**

```bash
git add skills/paperclip/SKILL.md
git commit -m "chore: compress paperclip skill — remove scaffolding prose, env vars to table"
```

---

### Task 6: Rewrite `skills/paperclip/references/api-reference.md` (647 → ~200 lines)

**Goal:** Convert to a pure lookup table. Anything that repeats SKILL.md must go. Examples stay only if they show a non-obvious field or pattern not shown in SKILL.md.

- [ ] **Step 1: Read and identify duplication**

```bash
wc -l skills/paperclip/references/api-reference.md
```

Scan for:
- Endpoint descriptions that restate the same info already in SKILL.md's heartbeat procedure
- Full request/response examples where the shape is already shown in SKILL.md
- Section headers and paragraph prose that can be replaced with table rows

- [ ] **Step 2: Apply rewrite**

Convert to a flat endpoint table with columns: Method, Path, Auth, Key Fields, Notes:

```markdown
# Paperclip API Reference

Auth on all requests: `Authorization: Bearer $PAPERCLIP_API_KEY`

## Agent

| Method | Path | Key fields | Notes |
|--------|------|-----------|-------|
| GET | `/api/agents/me` | id, companyId, role, chainOfCommand, budget | Primary identity call |
| GET | `/api/companies/{cId}/agents` | id, name, urlKey, status | Board only |
| POST | `/api/companies/{cId}/agents` | name, role, adapterType, adapterConfig | Board only |
| PATCH | `/api/agents/{id}` | name, status, adapterConfig | Board only |

## Issues

| Method | Path | Key fields | Notes |
|--------|------|-----------|-------|
| GET | `/api/agents/me/inbox-lite` | assignments[], cursor | Prefer over full issues list |
| GET | `/api/companies/{cId}/issues` | id, status, assignee, projectId | Query: status, assigneeAgentId |
| POST | `/api/issues/{id}/checkout` | agentId, expectedStatuses | 409 = owned by other agent — stop |
| GET | `/api/issues/{id}/heartbeat-context` | state, ancestors[], commentCursor | Preferred context fetch |
| GET | `/api/issues/{id}/comments` | comments[], cursor | Query: after={id}&order=asc |
| PATCH | `/api/issues/{id}` | status, comment | Include X-Paperclip-Run-Id |
| POST | `/api/issues` | title, status, assigneeAgentId, projectId | Create subtask |
...
```

Remove all prose between table rows. Remove worked examples that duplicate SKILL.md. Keep only examples for non-obvious request shapes (e.g., multi-step approval flows, comment cursor semantics).

- [ ] **Step 3: Verify size reduction**

```bash
wc -l skills/paperclip/references/api-reference.md
```

Target: ≤220 lines.

- [ ] **Step 4: Verify no endpoint is lost**

```bash
grep -c "^| GET\|^| POST\|^| PATCH\|^| DELETE\|^| PUT" skills/paperclip/references/api-reference.md
grep -c "^| GET\|^| POST\|^| PATCH\|^| DELETE\|^| PUT" skills/paperclip/references/api-reference.md.bak 2>/dev/null || echo "no bak"
```

Do a final read to confirm every endpoint from the original appears in the new table.

- [ ] **Step 5: Commit**

```bash
git add skills/paperclip/references/api-reference.md
git commit -m "chore: rewrite api-reference as pure lookup table — remove SKILL.md duplicates"
```

---

### Task 7: Rewrite `.agents/skills/create-agent-adapter/SKILL.md` (718 → ~300 lines)

**Goal:** This skill is only needed by agents that create new agent adapters. It's large because of inline worked examples. Move inline examples to reference blocks or cut if the rule is unambiguous.

- [ ] **Step 1: Read the file**

```bash
wc -l .agents/skills/create-agent-adapter/SKILL.md
head -50 .agents/skills/create-agent-adapter/SKILL.md
```

- [ ] **Step 2: Apply rewrite**

Key compressions for this file:
1. **Remove "How to use this skill" opener** — the agent invokes this skill; it doesn't need meta-instructions about itself.
2. **Move worked examples to collapsed reference section** — any example longer than 10 lines becomes a reference at the bottom. The body only says: "See reference: [example name]."
3. **Collapse repeated type definitions** — if a TypeScript type is shown in full multiple times with minor variations, show it once with a note.
4. **Strip doc-comment prose** — any comment that restates the type name is cut. E.g., `// The adapter type determines which runtime is used` above `adapterType: string` is cut.

- [ ] **Step 3: Verify size**

```bash
wc -l .agents/skills/create-agent-adapter/SKILL.md
```

Target: ≤320 lines.

- [ ] **Step 4: Commit**

```bash
git add .agents/skills/create-agent-adapter/SKILL.md
git commit -m "chore: compress create-agent-adapter skill — examples to reference section"
```

---

### Task 8: Rewrite remaining skill files

**Files:**
- `skills/para-memory-files/SKILL.md` (104 → ~70 lines)
- `skills/paperclip-create-agent/SKILL.md` (142 → ~100 lines)
- `skills/paperclip/references/company-skills.md` (193 → trim)

- [ ] **Step 1: Rewrite `skills/para-memory-files/SKILL.md`**

Apply principles: remove "Use this skill whenever..." opener (1 sentence lost), remove any bullet point that says what the next section explains, collapse PARA tier descriptions into a single table:

```markdown
| Tier | Path | Contains |
|------|------|----------|
| Projects | `P/` | Active work, living docs, plans |
| Areas | `A/` | Ongoing responsibilities |
| Resources | `R/` | Reference material |
| Archive | `Z/` | Inactive/completed |
```

Target: ≤75 lines.

- [ ] **Step 2: Rewrite `skills/paperclip-create-agent/SKILL.md`**

Remove the "overview" paragraph (restates the description frontmatter), cut any step that just says "read the config schema" (show the key fields instead), compress examples to show only request shape:

Target: ≤105 lines.

- [ ] **Step 3: Trim `skills/paperclip/references/company-skills.md`**

Remove repetition with `api-reference.md`. If any endpoint appears in both files, remove it from this one and add a cross-reference line.

Target: ≤130 lines.

- [ ] **Step 4: Verify total reduction**

```bash
wc -l skills/paperclip/SKILL.md skills/paperclip/references/api-reference.md \
       skills/paperclip/references/company-skills.md \
       .agents/skills/create-agent-adapter/SKILL.md \
       skills/para-memory-files/SKILL.md skills/paperclip-create-agent/SKILL.md
```

Total should be ≤1,080 lines (vs original 2,169 lines — ≥50% reduction).

- [ ] **Step 5: Commit**

```bash
git add skills/para-memory-files/SKILL.md skills/paperclip-create-agent/SKILL.md \
        skills/paperclip/references/company-skills.md
git commit -m "chore: compress para-memory-files, paperclip-create-agent, company-skills skills"
```

---

## Track D — Export Enhancement

### Task 9: Add memories and telemetry to portability export

**Files:**
- Modify: `packages/shared/src/types/company-portability.ts`
- Modify: `packages/shared/src/validators/company-portability.ts`
- Modify: `server/src/services/portability.ts`

Agent `adapterConfig` (which stores MCP settings, skill preferences) is already included in the agent export. This task adds agent memories and heartbeat telemetry.

- [ ] **Step 1: Check existing portability types and validators**

```bash
grep -n "CompanyPortabilityInclude\|memories\|telemetry" packages/shared/src/types/company-portability.ts
grep -n "companyPortabilityExportSchema\|memories\|telemetry" packages/shared/src/validators/company-portability.ts
```

Note the current `CompanyPortabilityInclude` fields and the Zod schema shape.

- [ ] **Step 2: Extend `CompanyPortabilityInclude`**

In `packages/shared/src/types/company-portability.ts`, add to the `CompanyPortabilityInclude` interface:

```typescript
export interface CompanyPortabilityInclude {
  company: boolean;
  agents: boolean;
  projects: boolean;
  issues: boolean;
  skills: boolean;
  memories: boolean;    // NEW: agent memory entries
  telemetry: boolean;   // NEW: heartbeat run summaries (last 90 days)
}
```

Also add types for the exported data:

```typescript
export interface CompanyPortabilityMemoryEntry {
  agentSlug: string;
  key: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPortabilityTelemetryEntry {
  agentSlug: string;
  runId: string;
  adapterType: string;
  sessionIdBefore: string | null;
  sessionIdAfter: string | null;
  usageJson: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}
```

And add to the manifest:

```typescript
export interface CompanyPortabilityManifest {
  // ... existing fields ...
  memoryCounts: { agentSlug: string; count: number }[];
  telemetryCounts: { agentSlug: string; count: number }[];
}
```

- [ ] **Step 3: Update the Zod validator**

In `packages/shared/src/validators/company-portability.ts`, find `companyPortabilityExportSchema` and add the two new booleans:

```typescript
export const companyPortabilityExportSchema = z.object({
  // ... existing fields ...
  memories: z.boolean().default(false),
  telemetry: z.boolean().default(false),
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm -r typecheck
```

Fix any type errors from the new interface fields.

- [ ] **Step 5: Implement export in portability.ts**

In `server/src/services/portability.ts`, find `exportBundle` and add two new sections after the existing entity exports.

First, find the DB imports at the top. Check what tables are imported. Add `agentMemories` and `heartbeatRuns` if not already imported:

```typescript
import { agentMemories, heartbeatRuns } from "@paperclipai/db";
```

Then, inside `exportBundle` where it checks `include.skills`, add:

```typescript
if (include.memories) {
  const agentRows = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const agentSlugById = new Map(agentRows.map((a) => [a.id, a.urlKey]));
  const memRows = await db.select().from(agentMemories)
    .where(inArray(agentMemories.agentId, agentRows.map((a) => a.id)));
  bundle.memories = memRows.map((row) => ({
    agentSlug: agentSlugById.get(row.agentId) ?? row.agentId,
    key: row.key,
    value: row.value,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

if (include.telemetry) {
  const agentRows = await db.select().from(agents).where(eq(agents.companyId, companyId));
  const agentSlugById = new Map(agentRows.map((a) => [a.id, a.urlKey]));
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days
  const runRows = await db.select().from(heartbeatRuns)
    .where(and(
      inArray(heartbeatRuns.agentId, agentRows.map((a) => a.id)),
      gte(heartbeatRuns.createdAt, cutoff),
    ));
  bundle.telemetry = runRows.map((row) => ({
    agentSlug: agentSlugById.get(row.agentId) ?? row.agentId,
    runId: row.id,
    adapterType: row.adapterType,
    sessionIdBefore: row.sessionIdBefore ?? null,
    sessionIdAfter: row.sessionIdAfter ?? null,
    usageJson: row.usageJson ?? null,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }));
}
```

Note: check the actual column names against the Drizzle schema in `packages/db/src/schema/heartbeat_runs.ts` and `agent_memories.ts` before writing the exact field names.

- [ ] **Step 6: Typecheck and test**

```bash
pnpm -r typecheck && pnpm test:run
```

Expected: all PASS. Fix any type errors in the portability service.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/types/company-portability.ts \
        packages/shared/src/validators/company-portability.ts \
        server/src/services/portability.ts
git commit -m "feat: extend company export to include agent memories and heartbeat telemetry"
```

---

## Task 10: Final verification and PR update

- [ ] **Step 1: Full build and test**

```bash
pnpm -r typecheck && pnpm test:run && pnpm build
```

All three must pass.

- [ ] **Step 2: Verify no secrets in diff**

```bash
git diff origin/main...HEAD -- '*.ts' '*.md' '*.json' | grep -iE "api_key|secret|password|token|bearer [a-z0-9]{20,}" | grep -v "PAPERCLIP_API_KEY\|Bearer \$PAPERCLIP" | head -20
```

Expected: no output (no hardcoded secrets).

- [ ] **Step 3: Push to fork**

```bash
git push fork fix/agent-kpi-field-mapping
```

- [ ] **Step 4: Update PR description**

```bash
gh pr edit --body "$(cat <<'EOF'
## Summary

- **Track A — Skill allowlists:** Default agent heartbeat now loads only the core `paperclip` skill. Specialist agents opt in to `para-memory-files`, `paperclip-create-agent`, or `*` (all) via `adapterConfig.paperclipSkillSync.desiredSkills`.
- **Track B — Content optimization:** Skill files reduced from 2,169 total lines to ~1,080 lines (≥50% reduction). No capability removed — API reference converted to lookup tables.
- **Track C — Claude telemetry:** Verified whether Claude CLI reports cumulative or per-run tokens; fixed delta logic accordingly.
- **Track D — Export enhancement:** Company export now optionally includes agent memories and heartbeat telemetry (last 90 days).

## Test plan
- [ ] `pnpm -r typecheck && pnpm test:run && pnpm build` passes
- [ ] Default agent config (no `desiredSkills` set) → only `paperclipai/paperclip/paperclip` skill mounted
- [ ] Agent with `desiredSkills: ["para-memory-files"]` → paperclip + para-memory-files mounted
- [ ] Agent with `desiredSkills: ["*"]` → all available skills mounted
- [ ] Company export with `memories: true` → includes agent memory entries
- [ ] Company export with `telemetry: true` → includes heartbeat run summaries
- [ ] Claude token counts in dashboard are non-zero and consistent across resumed sessions

🤖 Generated with [Claude Code](https://claude.ai/claude-code)
EOF
)"
```

---

## Execution Order

1. Task 1 (Track C) — read-only verification, no risk
2. Tasks 2–4 (Track A) — logic changes with test coverage
3. Tasks 5–8 (Track B) — content rewrites, no logic changes
4. Task 9 (Track D) — export enhancement
5. Task 10 — final verify + push + PR update
