# Paperclip Optimization Design

Date: 2026-04-23
Branch: fix/agent-kpi-field-mapping

## Context

The March 2026 token optimization plan identified 6 phases. Phases 1–5 are fully implemented. This spec covers the remaining work: Phase 6 (skill allowlists), content optimization (skill/doc rewrites), and Claude telemetry verification.

## Audit Summary

| Phase | Status | Notes |
|-------|--------|-------|
| 1 — Telemetry normalization | ✅ Done | `deriveNormalizedUsageDelta`, `rawInputTokens`, `usageSource: "session_delta"` |
| 2 — Session reuse on timer wakes | ✅ Done | Only resets on `issue_assigned` / `forceFreshSession` |
| 3 — Bootstrap prompt separation | ✅ Done | `bootstrapPromptTemplate` in Claude + Codex adapters |
| 4 — Delta APIs + skill rewrite | ✅ Done | `inbox-lite`, `heartbeat-context`, `comments?after=` |
| 5 — Session compaction | ✅ Done | `evaluateSessionCompaction` with rotation thresholds |
| 6 — Skill allowlists | ❌ Not done | All skills injected to all agents |

Current skill sizes (token budget concern):
- `skills/paperclip/SKILL.md`: 365 lines / 17KB
- `skills/paperclip/references/api-reference.md`: 647 lines
- `.agents/skills/create-agent-adapter/SKILL.md`: 718 lines / 31KB
- `skills/para-memory-files/SKILL.md`: 104 lines
- `skills/paperclip-create-agent/SKILL.md`: 142 lines

## Scope

Three parallel tracks:

---

## Track A — Phase 6: Skill Allowlists

### Problem

All repo skills are injected into every agent's runtime on every heartbeat, regardless of whether the agent needs them. Most agents only need the `paperclip` heartbeat skill. Specialist skills (`create-agent-adapter`, `para-memory-files`, `paperclip-create-agent`) add startup surface for no benefit in the common case.

### Design

Add `desiredSkills: string[]` to the agent's adapter config (already has a config object per adapter type). In `server/src/services/company-skills.ts`, when assembling the skill set to inject, filter against the agent's `desiredSkills` allowlist if present.

**Default behavior (no `desiredSkills` set):** inject `paperclip` only.
**Opt-in:** agent config includes `"desiredSkills": ["paperclip", "para-memory-files"]`.
**Override (all skills):** `"desiredSkills": ["*"]` or empty list = current behavior preserved for backward compat.

The allowlist is stored in the agent's `adapterConfig` JSON blob (existing field, no schema migration needed).

Expose the active skill set in run metadata (`heartbeatRuns.usageJson` or a new `skillsJson` field) so it's visible in the dashboard.

### Files touched
- `server/src/services/company-skills.ts` — add allowlist filtering
- `server/src/services/heartbeat.ts` — pass agent config into skill resolution
- `packages/shared/src/` — add `desiredSkills` to agent config type
- UI: `ui/src/` — expose desired skills in agent config editor

### Success criteria
- Default agent heartbeats load only `paperclip` skill
- Specialist agents that need extra skills opt in via config
- No regression in task completion for existing agents

---

## Track B — Content Optimization

### Problem

Skill files are verbose. `api-reference.md` at 647 lines duplicates material already in `SKILL.md`. `create-agent-adapter` at 718 lines has extensive inline examples that could be reference-only.

### Design

Rewrite each skill file with these principles:
1. **Instruction before example.** Keep the rule; move worked examples to a collapsible reference block or remove them if the rule is unambiguous.
2. **No repetition across SKILL.md and api-reference.md.** api-reference.md becomes a pure lookup table; anything narrative stays in SKILL.md.
3. **Remove scaffolding prose.** Phrases like "Use this when..." and "The following section describes..." add tokens without adding information.
4. **Tables over lists for structured data.** A 10-column table is cheaper than 10 bullet points with sub-bullets.

Target size reductions:
- `skills/paperclip/SKILL.md`: 365 → ~250 lines (30% reduction)
- `skills/paperclip/references/api-reference.md`: 647 → ~200 lines (70% reduction — move tables, cut examples)
- `.agents/skills/create-agent-adapter/SKILL.md`: 718 → ~300 lines (60% reduction)
- `skills/para-memory-files/SKILL.md`: 104 → ~70 lines (30% reduction)

### Files touched
- `skills/paperclip/SKILL.md`
- `skills/paperclip/references/api-reference.md`
- `skills/paperclip/references/company-skills.md`
- `.agents/skills/create-agent-adapter/SKILL.md`
- `skills/para-memory-files/SKILL.md`
- `skills/paperclip-create-agent/SKILL.md`

### Success criteria
- Total skill surface reduced by ≥40% in bytes
- No capability regression (all documented API endpoints still reachable via skill instructions)
- Skill descriptions remain unambiguous; no agent should need to guess at undocumented behavior

---

## Track C — Claude Telemetry Verification

### Problem

The plan identified that Codex reports cumulative session totals. The delta logic (`deriveNormalizedUsageDelta`) handles this. It is unclear whether Claude CLI (`claude`) reports per-run or cumulative tokens for a resumed session.

### Design

**Verification steps:**
1. Query the live Paperclip DB for Claude runs in the same session: look for runs where `sessionIdAfter = sessionIdBefore` and `usageSource = "session_delta"`.
2. Compare `rawInputTokens` across consecutive runs in that session. If they grow monotonically → cumulative (delta logic is needed and working). If they reset → per-run (delta logic subtracts unnecessarily but falls back correctly since `current < previous` uses `current`).
3. Check for any runs where `normalizedInputTokens` is negative or zero when `rawInputTokens` is large — this would indicate a bug.

**Fix if needed:**
If Claude reports per-run tokens (not cumulative), mark Claude runs with `usageSource: "per_run"` so the delta subtraction is skipped. This avoids false zeroes when the previous run had a larger value (e.g., due to a cache-heavy run followed by a cache-miss run).

### Files touched (if fix needed)
- `packages/adapters/claude-local/src/server/execute.ts` — set a flag on the result indicating per-run vs cumulative reporting
- `server/src/services/heartbeat.ts` — check flag before applying delta normalization

### Success criteria
- Claude token counts in the dashboard are believable and consistent with cost
- No zero-token or negative-token runs for active Claude sessions

---

## Rollout

1. Track C verification first (read-only, no risk)
2. Track A and B in parallel (independent)
3. Commit, push, update PR — no secrets in diff

## What is NOT in scope

- New API endpoints (already done in Phase 4)
- Session compaction thresholds (already done in Phase 5)
- Codex telemetry (already handled; this work only addresses Claude)
- UI overhaul
