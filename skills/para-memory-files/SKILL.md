---
name: para-memory-files
description: >
  File-based memory system using Tiago Forte's PARA method. Use this skill whenever
  you need to store, retrieve, update, or organize knowledge across sessions. Covers
  three memory layers: (1) Knowledge graph in PARA folders with atomic YAML facts,
  (2) Daily notes as raw timeline, (3) Tacit knowledge about user patterns. Also
  handles planning files, memory decay, weekly synthesis, and recall via qmd.
  Trigger on any memory operation: saving facts, writing daily notes, creating
  entities, running weekly synthesis, recalling past context, or managing plans.
---

# PARA Memory Files

Three memory layers. All paths relative to `$AGENT_HOME`.

## Three Memory Layers

### Layer 1: Knowledge Graph (`$AGENT_HOME/life/` -- PARA)

Each entity: `summary.md` (quick context, load first) and `items.yaml` (atomic facts, load on demand).

| Tier | Folder | Purpose |
|------|--------|---------|
| Projects | `P/` | Active work with defined goals/deadlines |
| Areas | `A/` | Ongoing responsibilities (people, companies) |
| Resources | `R/` | Reference material, topics of interest |
| Archive | `Z/` | Inactive items from any category |

```text
$AGENT_HOME/life/
  projects/<name>/{summary.md,items.yaml}
  areas/people/<name>/
  areas/companies/<name>/
  resources/<topic>/
  archives/
  index.md
```

**Fact rules:**
- Save durable facts immediately to `items.yaml`.
- Weekly: rewrite `summary.md` from active facts.
- Never delete facts. Supersede instead (`status: superseded`, add `superseded_by`).
- When an entity goes inactive, move its folder to `$AGENT_HOME/life/archives/`.

**Create an entity when:** mentioned 3+ times, OR direct relationship to user (family, coworker, partner, client), OR significant project/company. Otherwise, note it in daily notes.

For atomic fact YAML schema and memory decay rules, see [references/schemas.md](references/schemas.md).

### Layer 2: Daily Notes (`$AGENT_HOME/memory/YYYY-MM-DD.md`)

Raw timeline of events -- the "when" layer. Write continuously during conversations. Extract durable facts to Layer 1 during heartbeats.

### Layer 3: Tacit Knowledge (`$AGENT_HOME/MEMORY.md`)

How the user operates -- patterns, preferences, lessons learned. Update whenever you learn new operating patterns.

## Write It Down -- No Mental Notes

Memory does not survive session restarts. Files do. Want to remember something → write it to a file. Learn a lesson → update AGENTS.md, TOOLS.md, or the relevant skill file. Make a mistake → document it so future-you does not repeat it.

## Memory Recall -- Use qmd

```bash
qmd query "what happened at Christmas"   # Semantic search with reranking
qmd search "specific phrase"              # BM25 keyword search
qmd vsearch "conceptual question"         # Pure vector similarity
```

Index your personal folder: `qmd index $AGENT_HOME`

## Planning

Keep plans in timestamped files in `plans/` at the project root (outside personal memory so other agents can access them). Use `qmd` to search plans. If a newer plan exists, do not use the older one -- update the stale file to note `supersededBy`.
