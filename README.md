# Paperclip Surfers

> **Free community:** the current version of this, plus my other Claude Code skills, prompts and courses, is in my free Skool community: https://www.skool.com/iss-ai-automation-school-6342/about

> **Self-improving AI agent companies** — a V2 fork of [paperclipai/paperclip](https://github.com/paperclipai/paperclip) with persistent memory, MCP support, skills management, and a self-improvement loop.

<p align="center">
  <a href="https://github.com/IncomeStreamSurfer/paperclip-surfers/blob/master/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://harborseo.ai"><img src="https://img.shields.io/badge/built%20by-HarborSEO-brightgreen" alt="Built by HarborSEO" /></a>
</p>

Built by [HarborSEO](https://harborseo.ai) — an AI-powered SEO platform.

---

## What's new in V2

[Paperclip](https://github.com/paperclipai/paperclip) is an open-source control plane for AI agent companies. This fork adds:

### Persistent Conversations
Agents resume the same Claude Code conversation across all tasks within a project — no more starting fresh every run. Comments on tasks, new assignments, and wakeups all continue the same session.

### Agent Memory
Agents accumulate knowledge that persists across sessions:
- **Global memory** — cross-project learnings, CEO/board feedback, preferences
- **Project memory** — codebase patterns, team preferences, prior decisions
- Memory is automatically injected into every agent run as system prompt context

### MCP Integration
- **Sync from Claude Code** — discovers MCP servers you've already configured in `~/.claude.json` (one click)
- **Per-agent assignment** — assign specific MCPs to specific agents (CEO gets Slack, DevOps gets AWS)
- **Company defaults** — set MCPs for all agents, with per-agent overrides
- At runtime, `--mcp-config` is automatically passed to the Claude CLI

### Skills Selector
- User-installed skills from `~/.claude/skills` are now selectable per agent
- Checkbox UI in agent settings — toggle skills on/off per agent
- Selected skills are symlinked into the agent's execution directory at runtime

### Self-Improvement Loop
- **Post-run KPIs** — every run records: completion status, tokens, cost, duration, errors
- **Observations** — CEO agent or board humans log patterns they notice over time
- **Experiments** — opt-in A/B testing of approaches per agent
- **Analytics page** — company-wide performance trends across all agents

---

## Quickstart

Requirements: Node.js 20+, pnpm 9+

```bash
git clone https://github.com/IncomeStreamSurfer/paperclip-surfers.git
cd paperclip-surfers
pnpm install
pnpm dev
```

Open [http://localhost:3100](http://localhost:3100)

### One-command run (after first setup)

```bash
pnpm paperclipai run
```

### Docker

```bash
docker build -t paperclip-surfers .
docker run -p 3100:3100 -v ~/.paperclip:/paperclip paperclip-surfers
```

---

## Using the V2 features

### Sync your MCPs
1. Open the board → **MCPs** in sidebar
2. Click **Sync from Claude Code**
3. Your authenticated MCPs appear — check which to import
4. Assign to company (all agents) or specific agents

### Give an agent memory
1. Open an agent → **Memory** tab
2. Click **Add Memory** — choose global or project scope
3. Memory is injected every time the agent runs

### Select skills per agent
1. Open an agent → **Skills** tab
2. User-installed skills from `~/.claude/skills` appear with checkboxes
3. Check the skills this agent should have access to

### View agent performance
1. Open an agent → **Performance** tab
2. See KPI trends, add observations, track experiments

---

## Attribution

This project is a fork of [paperclipai/paperclip](https://github.com/paperclipai/paperclip).

Original work © 2025 Paperclip AI — MIT License.

V2 additions © 2025 [HarborSEO](https://harborseo.ai) — MIT License.

All original code, architecture, and design belongs to the Paperclip AI team. V2 adds new capabilities on top without modifying the core orchestration engine.

---

## License

MIT — see [LICENSE](LICENSE)
