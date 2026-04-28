---
name: paperclip-create-skill
description: >
  Auto-generate a new SKILL.md for a Paperclip agent given a name and description.
  Used internally by the skill generation endpoint to produce well-structured,
  immediately usable skill files.
---

# Paperclip Create Skill

## Purpose

This skill teaches an AI model how to write a high-quality SKILL.md file for a
Paperclip agent. Given a skill name and a description of what the skill should do,
it produces a complete, well-structured Markdown file ready to be installed.

## SKILL.md format

Every skill file must begin with a YAML front-matter block enclosed in `---` lines,
followed by the skill body in Markdown.

```
---
name: <human-readable skill name>
description: >
  <one or two sentence description of what the skill does>
---

# <Skill Name>

## Purpose
<What problem does this skill solve? When should an agent use it?>

## Prerequisites
<Any required tools, environment variables, permissions, or prior context.
Omit this section if there are none.>

## Workflow
<Step-by-step numbered instructions. Each step should be concrete and actionable.
Include example commands, API calls, or code snippets where appropriate.>

## Output
<What the agent should produce when the skill is complete: files, messages,
API calls, reports, etc.>

## Notes
<Optional: edge cases, gotchas, or tips. Omit if empty.>
```

## Writing guidelines

- **Be specific.** Vague instructions like "research the topic" are unhelpful.
  Instead write "search the web for X and summarize the top 3 results in a table."
- **Use imperative verbs.** Start steps with verbs: "Fetch", "Parse", "Write", "Send".
- **One responsibility per skill.** Keep scope narrow — agents compose skills.
- **Include examples.** A concrete example is worth a paragraph of explanation.
- **No hallucinated tools.** Only reference tools or APIs the agent is known to have.
- **Front-matter description is the agent's tooltip.** Keep it under 2 sentences.

## Example — "Weekly Digest Skill"

```markdown
---
name: weekly-digest
description: >
  Compile a weekly digest of completed tasks and key decisions from the past 7 days
  and send it to the configured email address.
---

# Weekly Digest Skill

## Purpose
Run every Monday to summarize the previous week for stakeholders who prefer email
over the Paperclip board.

## Prerequisites
- `PAPERCLIP_API_URL` and `PAPERCLIP_API_KEY` set
- Email notifications configured in instance settings
- Agent has read access to issues and runs

## Workflow

1. **Fetch completed issues** for the past 7 days:
   `GET /api/companies/:companyId/issues?status=done&since=<7-days-ago>`

2. **Fetch agent runs** finished in the past 7 days:
   `GET /api/companies/:companyId/runs?since=<7-days-ago>`

3. **Summarize** each section:
   - Total issues closed, broken down by project
   - Top 3 agents by tasks completed
   - Any issues still blocked

4. **Compose the email** in Markdown with a subject line:
   `Weekly Digest — week of <date>`

5. **Send** via the Paperclip notification endpoint or directly via the configured
   SMTP/SendGrid driver.

## Output
An email delivered to the configured recipient(s) with the weekly summary.

## Notes
- If no issues were closed, send a brief "quiet week" message rather than skipping.
- Use ISO 8601 dates in all API calls.
```
