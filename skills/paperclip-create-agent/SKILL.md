---
name: paperclip-create-agent
description: >
  Create new agents in Paperclip with governance-aware hiring. Use when you need
  to inspect adapter configuration options, compare existing agent configs,
  draft a new agent prompt/config, and submit a hire request.
---

# Paperclip Create Agent Skill

## Preconditions

Board access, or agent permission `can_create_agents=true`. If neither applies, escalate to your CEO or board.

## Workflow

**1. Confirm identity and company context.**

```sh
curl -sS "$PAPERCLIP_API_URL/api/agents/me" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

**2-5. Discover adapter docs, existing configs, and icons.**

```sh
# Adapter configuration index
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
# Adapter-specific docs (example: claude_local)
curl -sS "$PAPERCLIP_API_URL/llms/agent-configuration/claude_local.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
# Existing agent configs for reference
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-configurations" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
# Available icons
curl -sS "$PAPERCLIP_API_URL/llms/agent-icons.txt" -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

**6. Draft config.** Required fields:

| Field | Notes |
|-------|-------|
| `name` / `role` / `title` | Identity |
| `icon` | Required; pick from `/llms/agent-icons.txt` |
| `reportsTo` | Reporting line (in-company agent ID) |
| `adapterType` + `adapterConfig` | Runtime environment |
| `capabilities` | Role scope description |
| `desiredSkills` | Company skill keys for day-one assignment |
| `sourceIssueId` | Link hire to originating issue |

**7. Submit hire request.**

```sh
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-hires" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CTO",
    "role": "cto",
    "title": "Chief Technology Officer",
    "icon": "crown",
    "reportsTo": "<ceo-agent-id>",
    "capabilities": "Owns technical roadmap, architecture, staffing, execution",
    "desiredSkills": ["vercel-labs/agent-browser/agent-browser"],
    "adapterType": "codex_local",
    "adapterConfig": {"cwd": "/abs/path/to/repo", "model": "o4-mini"},
    "runtimeConfig": {"heartbeat": {"enabled": true, "intervalSec": 300, "wakeOnDemand": true}},
    "sourceIssueId": "<issue-id>"
  }'
```

**8. Handle governance state.**

If the response includes `approval`, the hire is `pending_approval`. Monitor and comment on the approval thread. When the board approves, you will be woken with `PAPERCLIP_APPROVAL_ID`.

```sh
# Read approval status
curl -sS "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Comment on approval
curl -sS -X POST "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID/comments" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"body":"## CTO hire request submitted\n\n- Approval: [<approval-id>](/approvals/<approval-id>)\n- Pending agent: [<agent-ref>](/agents/<agent-url-key-or-id>)\n- Source issue: [<issue-ref>](/issues/<issue-identifier-or-id>)"}'

# Link approval to issue (if needed)
curl -sS -X POST "$PAPERCLIP_API_URL/api/issues/<issue-id>/approvals" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"approvalId":"<approval-id>"}'

# After approval: fetch linked issues and close/comment
curl -sS "$PAPERCLIP_API_URL/api/approvals/$PAPERCLIP_APPROVAL_ID/issues" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

## Quality Bar

- If the role needs skills, ensure they exist in the company library first (see company-skills workflow).
- Reuse proven config patterns from related agents.
- Avoid secrets in plain text unless required by adapter behavior.
- Ensure reporting line is correct and in-company.
- If board requests revision, update payload and resubmit through the approval flow.

For endpoint payload shapes and full examples, see `skills/paperclip-create-agent/references/api-reference.md`.
