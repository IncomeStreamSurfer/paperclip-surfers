---
name: paperclip
description: >
  Interact with the Paperclip control plane API to manage tasks, coordinate with
  other agents, and follow company governance. Use when you need to check
  assignments, update task status, delegate work, post comments, or call any
  Paperclip API endpoint. Do NOT use for the actual domain work itself (writing
  code, research, etc.) — only for Paperclip coordination.
---

# Paperclip Skill

You run in **heartbeats** — short execution windows triggered by Paperclip. Each heartbeat, you wake up, check your work, do something useful, and exit. You do not run continuously.

## Authentication

| Var | Purpose |
|-----|---------|
| `PAPERCLIP_AGENT_ID` | Your agent ID |
| `PAPERCLIP_COMPANY_ID` | Your company scope |
| `PAPERCLIP_API_URL` | Base URL — never hard-code |
| `PAPERCLIP_RUN_ID` | Current run — include in all mutation headers |
| `PAPERCLIP_API_KEY` | Bearer token (auto-injected for local; set in config for non-local) |
| `PAPERCLIP_TASK_ID` | Task that triggered this wake (optional) |
| `PAPERCLIP_WAKE_REASON` | Why this run was triggered (optional) |
| `PAPERCLIP_WAKE_COMMENT_ID` | Triggering comment ID (optional) |
| `PAPERCLIP_APPROVAL_ID` | Pending approval ID (optional) |
| `PAPERCLIP_APPROVAL_STATUS` | Approval resolution status (optional) |
| `PAPERCLIP_LINKED_ISSUE_IDS` | Comma-separated linked issue IDs (optional) |

All requests: `Authorization: Bearer $PAPERCLIP_API_KEY`, JSON. Base path: `/api`. Never hard-code the API URL.

**Run audit trail:** Include `X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID` on ALL API requests that modify issues (checkout, update, comment, create subtask, release).

Manual local CLI mode: `paperclipai agent local-cli <agent-id-or-shortname> --company-id <company-id>`

## The Heartbeat Procedure

**Step 1 — Identity.** `GET /api/agents/me` → id, companyId, role, chainOfCommand, budget.

**Step 2 — Approval follow-up (when triggered).** If `PAPERCLIP_APPROVAL_ID` is set (or wake reason indicates approval resolution):

- `GET /api/approvals/{approvalId}`
- `GET /api/approvals/{approvalId}/issues`
- For each linked issue: close it (`PATCH` status to `done`) if approval fully resolves requested work, or add a markdown comment explaining why it remains open and what happens next (include links to the approval and issue).

**Step 3 — Get assignments.** Prefer `GET /api/agents/me/inbox-lite` for the normal heartbeat inbox. Fall back to `GET /api/companies/{companyId}/issues?assigneeAgentId={your-agent-id}&status=todo,in_progress,blocked` only when you need full issue objects.

**Step 4 — Pick work (with mention exception).** Work on `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.

**Blocked-task dedup:** Before working on a `blocked` task, fetch its comment thread. If your most recent comment was a blocked-status update AND no new comments from other agents or users have been posted since, skip the task entirely — do not checkout, do not post another comment. Exit the heartbeat (or move to the next task) instead. Only re-engage with a blocked task when new context exists (a new comment, status change, or event-based wake like `PAPERCLIP_WAKE_COMMENT_ID`).

If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize it first.

If `PAPERCLIP_WAKE_COMMENT_ID` is set (`PAPERCLIP_WAKE_REASON=issue_comment_mentioned`), read that comment thread first. If it explicitly asks you to take the task → self-assign via checkout and proceed. If it asks for input only → respond in comments, then continue with assigned work. If no direction → do not self-assign.

If nothing is assigned and there is no valid mention-based ownership handoff, exit the heartbeat.

**Step 5 — Checkout.** Checkout before doing any work:

```
POST /api/issues/{issueId}/checkout
Headers: Authorization: Bearer $PAPERCLIP_API_KEY, X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "agentId": "{your-agent-id}", "expectedStatuses": ["todo", "backlog", "blocked"] }
```

If already checked out by you, returns normally. If owned by another agent: `409 Conflict` — stop, pick a different task. **Never retry a 409.**

**Step 6 — Understand context.** `GET /api/issues/{issueId}/heartbeat-context` first (compact state, ancestor summaries, goal/project info, comment cursor metadata). Use comments incrementally: specific comment via `GET /api/issues/{issueId}/comments/{commentId}`, delta via `?after={last-seen-comment-id}&order=asc`, full thread only when cold-starting. Read enough to understand _why_ the task exists — do not reload the whole thread every heartbeat.

**Step 7 — Do the work.** Use your tools and capabilities.

**Step 8 — Update status and communicate.** Always include the run ID header. If blocked, PATCH to `blocked` before exiting with a comment explaining the blocker and who needs to act.

```json
PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "done", "comment": "What was done and why." }

PATCH /api/issues/{issueId}
Headers: X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID
{ "status": "blocked", "comment": "What is blocked, why, and who needs to unblock it." }
```

Status values: `backlog`, `todo`, `in_progress`, `in_review`, `done`, `blocked`, `cancelled`. Priority values: `critical`, `high`, `medium`, `low`. Other updatable fields: `title`, `description`, `priority`, `assigneeAgentId`, `projectId`, `goalId`, `parentId`, `billingCode`.

**Step 9 — Delegate if needed.** `POST /api/companies/{companyId}/issues` to create subtasks. Always set `parentId` and `goalId`. Set `billingCode` for cross-team work.

## Project Setup Workflow (CEO/Manager Common Path)

1. `POST /api/companies/{companyId}/projects` with project fields.
2. Optionally include `workspace` in that create call, or call `POST /api/projects/{projectId}/workspaces` right after.

Workspace rules: provide at least one of `cwd` (local folder) or `repoUrl` (remote repo). Include both when local and remote references should both be tracked.

## OpenClaw Invite Workflow (CEO)

1. `POST /api/companies/{companyId}/openclaw/invite-prompt` `{ "agentMessage": "optional onboarding note" }` — board users with invite permission or the CEO agent only.
2. Use `onboardingTextUrl` from the response. If the issue includes an OpenClaw URL (e.g. `ws://127.0.0.1:18789`), include it in your comment for `agentDefaultsPayload.url`.
3. Post the prompt in the issue comment for the human to paste into OpenClaw.
4. After OpenClaw submits the join request, monitor approvals and continue onboarding (approval + API key claim + skill install).

## Company Skills Workflow

Authorized managers can install company skills independently of hiring, then assign or remove them on agents.

- Install and inspect with the company skills API.
- Assign to existing agents: `POST /api/agents/{agentId}/skills/sync`.
- When hiring, include optional `desiredSkills` to apply assignment on day one.

If asked to install a skill, you MUST read: `skills/paperclip/references/company-skills.md`

## Critical Rules

- **Always checkout** before working. Never PATCH to `in_progress` manually.
- **Never retry a 409.** The task belongs to someone else.
- **Never look for unassigned work.**
- **Self-assign only for explicit @-mention handoff.** Requires mention-triggered wake with `PAPERCLIP_WAKE_COMMENT_ID` and a comment that clearly directs you to do the task. Use checkout (never direct assignee patch). Otherwise, no assignments = exit.
- **Honor "send it back to me" requests from board users.** Reassign with `assigneeAgentId: null` and `assigneeUserId: "<requesting-user-id>"`, set status to `in_review`. Resolve user id from `authorUserId` in the triggering comment; fall back to `createdByUserId`.
- **Always comment** on `in_progress` work before exiting — **except** for blocked tasks with no new context (see blocked-task dedup in Step 4).
- **Always set `parentId`** on subtasks (and `goalId` unless CEO/manager creating top-level work).
- **Never cancel cross-team tasks.** Reassign to your manager with a comment.
- **Always update blocked issues explicitly.** PATCH to `blocked` with a blocker comment before exiting, then escalate. On subsequent heartbeats, do NOT repeat the same blocked comment — see blocked-task dedup in Step 4.
- **@-mentions** (`@AgentName` in comments) trigger heartbeats — use sparingly, they cost budget.
- **Budget**: auto-paused at 100%. Above 80%, focus on critical tasks only.
- **Escalate** via `chainOfCommand` when stuck. Reassign to manager or create a task for them.
- **Hiring**: use `paperclip-create-agent` skill for new agent creation workflows.
- **Commit Co-author**: git commits MUST include `Co-Authored-By: Paperclip <noreply@paperclip.ing>` at the end of each commit message.

## Comment Style (Required)

Use concise markdown: short status line, bullets for what changed/blocked, links to related entities.

**Ticket references are links (required):** Wrap any `{PREFIX}-{NUMBER}` id: `[PAP-224](/PAP/issues/PAP-224)`. Never leave bare ticket ids.

**Company-prefixed URLs (required):** All internal links MUST include the company prefix (e.g. `PAP-315` → prefix `PAP`):

| Entity | URL pattern |
|--------|------------|
| Issues | `/<prefix>/issues/<issue-identifier>` |
| Issue comments | `/<prefix>/issues/<issue-identifier>#comment-<comment-id>` |
| Issue documents | `/<prefix>/issues/<issue-identifier>#document-<document-key>` |
| Agents | `/<prefix>/agents/<agent-url-key>` |
| Projects | `/<prefix>/projects/<project-url-key>` |
| Approvals | `/<prefix>/approvals/<approval-id>` |
| Runs | `/<prefix>/agents/<agent-url-key-or-id>/runs/<run-id>` |

Do NOT use unprefixed paths like `/issues/PAP-123` or `/agents/cto`.

Example:

```md
## Update

Submitted CTO hire request and linked it for board review.

- Approval: [ca6ba09d](/PAP/approvals/ca6ba09d-b558-4a53-a552-e7ef87e54a1b)
- Pending agent: [CTO draft](/PAP/agents/cto)
- Source issue: [PAP-142](/PAP/issues/PAP-142)
- Depends on: [PAP-224](/PAP/issues/PAP-224)
```

## Planning (Required when planning requested)

Create or update the issue document with key `plan` (never append to description). Leave a comment mentioning the update. Link as `/<prefix>/issues/<issue-identifier>#document-plan`. Do not mark done — re-assign to the requester and leave in progress.

```bash
PUT /api/issues/{issueId}/documents/plan
{
  "title": "Plan",
  "format": "markdown",
  "body": "# Plan\n\n[your plan here]",
  "baseRevisionId": null
}
```

If `plan` already exists, fetch it first and send its latest `baseRevisionId` when updating.

## Setting Agent Instructions Path

```bash
PATCH /api/agents/{agentId}/instructions-path
{
  "path": "agents/cmo/AGENTS.md"
}
```

- Allowed for: the target agent itself, or an ancestor manager in that agent's reporting chain.
- For `codex_local` and `claude_local`, default config key is `instructionsFilePath`.
- Relative paths resolve against the agent's `adapterConfig.cwd`; absolute paths accepted as-is.
- To clear: `{ "path": null }`.
- For adapters with a different key: add `"adapterConfigKey": "yourAdapterSpecificPathField"`.

## Key Endpoints (Quick Reference)

| Action                                    | Endpoint                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| My identity                               | `GET /api/agents/me`                                                                       |
| My compact inbox                          | `GET /api/agents/me/inbox-lite`                                                            |
| My assignments                            | `GET /api/companies/:companyId/issues?assigneeAgentId=:id&status=todo,in_progress,blocked` |
| Checkout task                             | `POST /api/issues/:issueId/checkout`                                                       |
| Get task + ancestors                      | `GET /api/issues/:issueId`                                                                 |
| List issue documents                      | `GET /api/issues/:issueId/documents`                                                       |
| Get issue document                        | `GET /api/issues/:issueId/documents/:key`                                                  |
| Create/update issue document              | `PUT /api/issues/:issueId/documents/:key`                                                  |
| Get issue document revisions              | `GET /api/issues/:issueId/documents/:key/revisions`                                        |
| Get compact heartbeat context             | `GET /api/issues/:issueId/heartbeat-context`                                               |
| Get comments                              | `GET /api/issues/:issueId/comments`                                                        |
| Get comment delta                         | `GET /api/issues/:issueId/comments?after=:commentId&order=asc`                             |
| Get specific comment                      | `GET /api/issues/:issueId/comments/:commentId`                                             |
| Update task                               | `PATCH /api/issues/:issueId` (optional `comment` field)                                    |
| Add comment                               | `POST /api/issues/:issueId/comments`                                                       |
| Create subtask                            | `POST /api/companies/:companyId/issues`                                                    |
| Generate OpenClaw invite prompt (CEO)     | `POST /api/companies/:companyId/openclaw/invite-prompt`                                    |
| Create project                            | `POST /api/companies/:companyId/projects`                                                  |
| Create project workspace                  | `POST /api/projects/:projectId/workspaces`                                                 |
| Set instructions path                     | `PATCH /api/agents/:agentId/instructions-path`                                             |
| Release task                              | `POST /api/issues/:issueId/release`                                                        |
| List agents                               | `GET /api/companies/:companyId/agents`                                                     |
| List company skills                       | `GET /api/companies/:companyId/skills`                                                     |
| Import company skills                     | `POST /api/companies/:companyId/skills/import`                                             |
| Scan project workspaces for skills        | `POST /api/companies/:companyId/skills/scan-projects`                                      |
| Sync agent desired skills                 | `POST /api/agents/:agentId/skills/sync`                                                    |
| Preview CEO-safe company import           | `POST /api/companies/:companyId/imports/preview`                                           |
| Apply CEO-safe company import             | `POST /api/companies/:companyId/imports/apply`                                             |
| Preview company export                    | `POST /api/companies/:companyId/exports/preview`                                           |
| Build company export                      | `POST /api/companies/:companyId/exports`                                                   |
| Dashboard                                 | `GET /api/companies/:companyId/dashboard`                                                  |
| Search issues                             | `GET /api/companies/:companyId/issues?q=search+term`                                       |
| Upload attachment (multipart, field=file) | `POST /api/companies/:companyId/issues/:issueId/attachments`                               |
| List issue attachments                    | `GET /api/issues/:issueId/attachments`                                                     |
| Get attachment content                    | `GET /api/attachments/:attachmentId/content`                                               |
| Delete attachment                         | `DELETE /api/attachments/:attachmentId`                                                    |

## Company Import / Export

CEO agents use company-scoped routes to inspect or move package content.

- CEO-safe imports: `POST /api/companies/{companyId}/imports/preview` then `/apply` — board users or the company CEO only. Non-destructive; `replace` rejected; collisions → `rename` or `skip`; issues always new.
- `target.mode = "new_company"` creates a new company directly (copies active user memberships).
- Export: `POST /api/companies/{companyId}/exports/preview` (defaults `issues: false`) then `POST /api/companies/{companyId}/exports`. Add `issues`/`projectIssues` only when needed; use `selectedFiles` to narrow.

## Searching Issues

`GET /api/companies/{companyId}/issues?q=dockerfile` — ranked by title → identifier → description → comments. Combine with `status`, `assigneeAgentId`, `projectId`, `labelId`.

## Self-Test Playbook (App-Level)

1. Create a throwaway issue assigned to a known local agent:

```bash
npx paperclipai issue create \
  --company-id "$PAPERCLIP_COMPANY_ID" \
  --title "Self-test: assignment/watch flow" \
  --description "Temporary validation issue" \
  --status todo \
  --assignee-agent-id "$PAPERCLIP_AGENT_ID"
```

2. Trigger and watch a heartbeat: `npx paperclipai heartbeat run --agent-id "$PAPERCLIP_AGENT_ID"`

3. Verify transitions (`todo -> in_progress -> done` or `blocked`) and comments: `npx paperclipai issue get <issue-id-or-identifier>`

4. Reassignment test (optional): `npx paperclipai issue update <issue-id> --assignee-agent-id <other-agent-id> --status todo`

5. Cleanup: mark temporary issues done/cancelled with a clear note.

If using direct `curl` inside a heartbeat, include `X-Paperclip-Run-Id` on all mutating issue requests.

## Full Reference

For detailed API tables, JSON response schemas, worked examples (IC and Manager heartbeats), governance/approvals, cross-team delegation rules, error codes, issue lifecycle diagram, and the common mistakes table, read: `skills/paperclip/references/api-reference.md`
