# Company Skills Workflow

Reference for finding, installing, assigning, and updating skills in the company library.

## Model

1. Install skill into the company library.
2. Assign the company skill to an agent.
3. Optionally combine steps 1+2 during hire/create via `desiredSkills`.

## Permission Model

| Operation | Who can do it |
|-----------|--------------|
| Read company skills | Any same-company actor |
| Mutate company skills | Board, CEO, or agent with `agents:create` capability |
| Assign skills to agent | Same permission as updating that agent |

## Install A Skill Into The Company

### Source types (in order of preference)

| Source format | Example | When to use |
|---|---|---|
| **skills.sh URL** | `https://skills.sh/google-labs-code/stitch-skills/design-md` | Managed registry — prefer this when available |
| **Key-style string** | `google-labs-code/stitch-skills/design-md` | Shorthand (`org/repo/skill-name`) — equivalent to skills.sh URL |
| **GitHub URL** | `https://github.com/vercel-labs/agent-browser` | Skill in GitHub but not on skills.sh |
| **Local path** | `/abs/path/to/skill-dir` | Dev/testing only |

**Critical:** If a user gives you a `https://skills.sh/...` URL, use that URL or its key-style equivalent as `source`. Do not convert it to a GitHub URL.

```sh
# skills.sh import (preferred)
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/skills/import" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "google-labs-code/stitch-skills/design-md"}'

# GitHub import
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/skills/import" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source": "https://github.com/vercel-labs/agent-browser"}'

# Discover skills from project workspaces
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/skills/scan-projects" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Inspect Installed Skills

```sh
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/skills" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Single skill + its SKILL.md
curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/skills/<skill-id>" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

curl -sS "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/skills/<skill-id>/files?path=SKILL.md" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"
```

## Assign Skills To An Existing Agent

`desiredSkills` accepts: exact company skill key, exact company skill ID, or slug (when unique in company). The server persists canonical company skill keys.

```sh
# Read current skills
curl -sS "$PAPERCLIP_API_URL/api/agents/<agent-id>/skills" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY"

# Sync desired skills
curl -sS -X POST "$PAPERCLIP_API_URL/api/agents/<agent-id>/skills/sync" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"desiredSkills": ["vercel-labs/agent-browser/agent-browser"]}'
```

## Include Skills During Hire Or Create

Pass `desiredSkills` in the hire or create payload (see `api-reference.md` for full field list):

```sh
# Via agent-hires (approval flow)
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agent-hires" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "QA Browser Agent", "role": "qa", "adapterType": "codex_local",
       "adapterConfig": {"cwd": "/abs/path/to/repo"}, "desiredSkills": ["agent-browser"]}'

# Via direct create (no approval)
curl -sS -X POST "$PAPERCLIP_API_URL/api/companies/$PAPERCLIP_COMPANY_ID/agents" \
  -H "Authorization: Bearer $PAPERCLIP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "QA Browser Agent", "role": "qa", "adapterType": "codex_local",
       "adapterConfig": {"cwd": "/abs/path/to/repo"}, "desiredSkills": ["agent-browser"]}'
```

## Notes

- Built-in Paperclip runtime skills are added automatically when required by the adapter.
- If a reference is missing or ambiguous, the API returns `422`.
- Prefer linking back to the relevant issue, approval, and agent when commenting about skill changes.
- For whole-package import/export (not just skills), see the Company Import/Export section in `api-reference.md`.
