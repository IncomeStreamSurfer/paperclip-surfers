# Paperclip Pro+ Roadmap

> **Vision**: Turn Paperclip into a full-featured, white-label AI Business Platform — self-hosted or cloud — with industry-specific modules, rich UI/UX, and enterprise-grade extras.
>
> **Status key**: ✅ Done · 🔄 In progress · 🔲 Not started · ❌ Blocked

---

## 0. Infrastructure & Fork

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Create private fork under SplatDev | ✅ | `fork` remote → `ba6420ab` |
| 0.2 | Keep all plan docs in `doc/plans/` with `YYYY-MM-DD-slug.md` names | ✅ | This file |

---

## 1. UI / UX Improvements

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Sidebar: collapsible accordion sections with hover-only chevron | ✅ | `SidebarSection`, `SidebarProjects`, `SidebarAgents` |
| 1.2 | Sidebar: company logo in header + dropdown switcher | ✅ | `CompanyPatternIcon` + dropdown |
| 1.3 | Sidebar: company favorites (star, persisted) | ✅ | `CompanyContext` + `favoriteCompanyIds` |
| 1.4 | Sidebar: nav-item favorites (star → Favorites section) | ✅ | `useSidebar` favorites |
| 1.5 | Sidebar: project favorites (star, sorted to top, persisted) | ✅ | `favoriteProjectIds` in `SidebarContext` |
| 1.6 | Sidebar: agent favorites (star, sorted to top, persisted) | ✅ | `favoriteAgentIds` in `SidebarContext` |
| 1.7 | Sidebar: collapse-all / expand-all toggle button next to logo | ✅ | `ChevronsUp`/`ChevronsDown` in `Sidebar.tsx` |
| 1.8 | Sidebar: separator lines between accordion groups | ✅ | `<hr>` dividers in `Sidebar.tsx` |
| 1.9 | Sidebar: badge / live-count text clears star (pr-7 padding) | ✅ | `SidebarNavItem`, `SidebarAgents`, `SidebarProjects` |
| 1.10 | Sidebar: theme-aware scrollbar (CSS vars, Firefox `scrollbar-color`) | ✅ | `index.css` |
| 1.11 | Sidebar: remove left CompanyRail completely | ✅ | `Layout.tsx` |
| 1.12 | Theme system: `ColorSchemaProvider` sole authority, sun/moon toggle | ✅ | `ThemeProvider` removed |
| 1.13 | Department label bug fix (z-index, not clipped) | ✅ | `Departments.tsx` |
| 1.14 | OrgChart department outline style (dashed, offset, label outside) | ✅ | `OrgChart.tsx` |
| 1.15 | Instance settings: "Return to Business" link on all pages | ✅ | `InstanceSidebar`, all instance pages |
| 1.16 | Allow changing project deadline (date picker in project settings) | ✅ | `ProjectProperties.tsx` editable date input; `targetDate` field |
| 1.17 | Update onboarding wizard (less confusing, better copy) | ✅ | Step headings rewritten; step 3 Skip; step 4 "Launch" CTA |
| 1.18 | Add bigger color palette for projects (more swatches) | ✅ | 10 → 20 swatches + native color input + hex field |
| 1.19 | Dashboard widgets: token usage, burndown, agent idle lounge, etc. | ✅ | Project Health widget + all chart widgets complete |
| 1.20 | White-label: custom icon sets (favicon, app icon) | ✅ | Favicon + app icon upload in Instance General Settings; site title; BrandingInjector in App.tsx |

---

## 2. User Management & Profiles

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | User profile page: avatar, display name, email, password | ✅ | `ProfilePage.tsx` with avatar upload, name, change-password |
| 2.2 | Profile page route (`/profile`) + sidebar footer link | ✅ | `App.tsx` route; sidebar footer replaced with user avatar + name |
| 2.3 | Admin user management page (list users, roles, invite, deactivate) | ✅ | `InstanceUsersPage.tsx`; ban/unban + promote/demote; migration 0053 |
| 2.4 | Company-level roles and permissions UI | ✅ | `CompanyMemberPermissions.tsx` — 6 permission key toggles per member |
| 2.5 | User preferences (language, timezone, notification opt-outs) | ✅ | `preferences` JSONB on `user_profiles` (migration 0055); timezone/language selects + email opt-outs in `ProfilePage` |

---

## 3. Notifications & Email

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | SMTP service (`server/src/services/email.ts`) | ✅ | nodemailer-based |
| 3.2 | `notifications` JSONB column in `instance_settings` (migration 0052) | ✅ | — |
| 3.3 | Server routes: GET/PATCH `/instance/settings/notifications`, POST `.../test` | ✅ | — |
| 3.4 | UI API client: `getNotifications`, `updateNotifications`, `testNotification` | ✅ | `api/instanceSettings.ts` |
| 3.5 | Query key: `queryKeys.instance.notificationSettings` | ✅ | — |
| 3.6 | Notifications settings page (`InstanceNotificationsSettings.tsx`) | ✅ | Full SMTP form + test |
| 3.7 | Notifications route in `App.tsx` + sidebar entry in `InstanceSidebar` | ✅ | Done |
| 3.8 | Trigger email on issue `→ blocked` transition (issues.ts PATCH) | ✅ | Fire-and-forget |
| 3.9 | Email API providers: Mailgun driver | ✅ | SMTP relay via smtp.mailgun.org; emailProvider/mailgunDomain/mailgunApiKey in instance settings |
| 3.10 | Email API providers: SendGrid driver | ✅ | SMTP relay via smtp.sendgrid.net:587; username "apikey"; sendgridApiKey in instance settings; UI option in emailProvider select |
| 3.11 | Per-user email notification preferences | ✅ | emailOnBlocked/emailOnMention/emailOnAssigned/emailDigest in user_profiles.preferences (2.5) |
| 3.12 | Digest / summary emails (daily or weekly) | ✅ | sendDigestEmail(); digest-scheduler.ts hourly tick; daily UTC 08:00; weekly Mondays |

---

## 4. Agent Avatars

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | `avatar_url` column on `agents` table (migration 0051) | ✅ | — |
| 4.2 | `AgentIcon` renders `<img>` when `avatarUrl` present | ✅ | — |
| 4.3 | Upload / remove avatar UI in `AgentDetail` header | ✅ | — |
| 4.4 | Avatar visible in sidebar + org chart | ✅ | — |
| 4.5 | ComfyUI service (`server/src/services/comfyui.ts`) | ✅ | 8 styles; per-style checkpoints + steps; `temperatureToCfg()`; `getCheckpoints()`; `pickCheckpoint()` fallback; `expandPrompt()` Ollama |
| 4.6 | `POST /agents/:id/generate-avatar` route | ✅ | 8 styles + `temperature` (1–10); ordered fallback retry across all checkpoints; 503 if none available |
| 4.7 | `AvatarGeneratorPanel` in AgentDetail config tab | ✅ | 8-style grid; gender; Temperature slider; checkpoint gate; Expand with AI |
| 4.8 | Prompt expansion via Ollama (`brxce/stable-diffusion-prompt-generator`) | ✅ | `comfyui.expandPrompt()` via Ollama; description textarea + Expand with AI in panel |

---

## 5. Model Management (Pro+)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | `company_allowed_models` table (migration 0050) | ✅ | — |
| 5.2 | Model discovery + Pro+ admin routes | ✅ | — |
| 5.3 | `ui/src/api/models.ts` + `ModelSettings` page | ✅ | Ollama card grid (2→3→4 cols, hover-reveal delete); OpenCode Go panel; vLLM GPU servers |
| 5.4 | Support Ollama (local) | ✅ | `OLLAMA_KEEP_ALIVE=-1`; pull model form; installed card grid |
| 5.5 | Support OpenAI | ✅ | API key stored in `instance_settings.general`; key CRUD routes; model discovery with prefix filter; `OpenAISection` in ModelSettings |
| 5.6 | Support OpenRouter | ✅ | Same pattern as OpenAI; `OpenRouterSection` in ModelSettings; 300+ models via `/models/openrouter/models` |
| 5.7 | Support vLLM | ✅ | `vllm_endpoints` table (migration 0058); add/probe/delete GPU server UI |
| 5.8 | Support Vercel AI gateway | ✅ | API key + base URL stored in `instance_settings.general`; key CRUD routes; `VercelAISection` wired into ModelSettings |
| 5.9 | Support Azure OpenAI | ✅ | Azure key + endpoint + api-version; `/openai/deployments` response parsing; `AzureOpenAISection` wired into ModelSettings |
| 5.10 | Cloud mode: system-selected models, limited user choice | 🔲 | Deployment mode flag |
| 5.11 | OpenCode Go section (cloud model list + subscription info) | ✅ | Static model grid (Standard / Pro tiers); upsell card in `ModelSettings` |

---

## 6. Skills & Agents

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Skills deduplication by `skill.key` | ✅ | `AgentSkillSelector.tsx` |
| 6.2 | Search skills.sh when creating new agent | ✅ | Static catalog (30 entries); collapsible Discover section in NewAgent — search + category filter + Install button + auto-select on install |
| 6.3 | Auto-generate skill for new agent if not found on skills.sh | ✅ | bundled `paperclip-create-skill` SKILL.md template; `POST /companies/:id/skills/generate` calls Ollama; Generate with AI section in NewAgent |
| 6.4 | Agent templates: CEO, CTO, CMO, etc. | ✅ | `agent-templates.ts` — 12 pre-built role configs; template picker in `NewAgentDialog`; `?template=` param pre-fills `NewAgent` |
| 6.5 | Support for departments: memories, rules, guidelines, routines | ✅ | Departments.tsx rewritten: 3-tab expandable cards (Agents, Rules & Guidelines, Memory); inline editing; memory append/remove routes |
| 6.6 | Company memory bank + MemPalace / vector DB | 🔲 | Long-term research task |

---

## 7. MCP & Tool Ecosystem

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Search for new MCP tools based on industry/focus | ✅ | Discovery UI |
| 7.2 | Per-department MCP lists (curated defaults) | ✅ | `mcpKeys jsonb` on departments; "Default MCPs" tab in Departments.tsx; `DepartmentSuggestedMcps` in McpServers.tsx |
| 7.3 | Docker image ships with default MCPs (Chrome, filesystem, etc.) | ✅ | Dockerfile pre-installs `@modelcontextprotocol/server-filesystem`, `mcp-fetch`, `@modelcontextprotocol/server-github`; `seed-mcps.ts` idempotent seeder |
| 7.4 | Support Azure DevOps integration | ✅ | `azure-devops-mcp` catalog entry (`@azure-devops/mcp`); suggested for `software_agency` + `msp_rmm` |
| 7.5 | Support BitBucket integration | ✅ | `bitbucket-mcp` catalog entry; suggested for `software_agency` |
| 7.6 | Support GitLab integration | ✅ | `gitlab-mcp` catalog entry (`@modelcontextprotocol/server-gitlab`); suggested for `software_agency` |

---

## 8. Dashboard Widgets

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | Token usage (total, per-agent, per-department, per-project) | ✅ | `GET /dashboard/token-usage`; `TokenUsageChart` horizontal bar |
| 8.2 | Agent time worked / idle | ✅ | `GET /dashboard/agent-time`; `AgentTimeChart` wall-clock bar per agent |
| 8.3 | Burndown chart (issues open/closed over time) | ✅ | `GET /dashboard/burndown`; `BurndownChart` side-by-side bars |
| 8.4 | Idle agents lounge with avatars | ✅ | `IdleAgentsLounge.tsx` — idle agents grid with avatar + status dot on dashboard |
| 8.5 | Commits per agent | 🔲 | Git integration |
| 8.6 | Tasks per agent / per department | ✅ | `GET /dashboard/tasks-by-agent`; `TasksByAgentChart` horizontal bar with open/in-progress/done breakdown |
| 8.7 | Widget drag-and-drop layout (user configurable) | ✅ | `@dnd-kit/sortable` in `Dashboard.tsx`; `useDashboardConfig` localStorage hook; "Customize" toggle + "Add Widget" panel; time-range filter pills |

---

## 9. Browser Automation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 9.1 | Full browser support via Chrome/Playwright from server | 🔲 | Existing `chrome-tools` MCP partial |
| 9.2 | Page snapshot (screenshot) feature | 🔲 | — |
| 9.3 | Video recording of browser sessions | 🔲 | — |

---

## 10. Reporting & Scrum

| # | Task | Status | Notes |
|---|------|--------|-------|
| 10.1 | Automated Scrum artifacts (sprint reports, velocity) | ✅ | DB, shared validators, server CRUD + velocity + Ollama AI report, UI Sprints page |
| 10.2 | Export reports (PDF, Markdown) | ✅ | Sprint report Markdown download via blob+anchor |
| 10.3 | Goal metrics and tracking charts | ✅ | `GET /companies/:id/goals/metrics`; summary bar in `Goals.tsx`; Progress tab in `GoalDetail.tsx` |

---

## 11. Project & Workspace

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11.1 | Project categories and grouping by department | ✅ | Group-by-department toggle in Projects.tsx; departmentId FK on projects |
| 11.2 | Project metrics (velocity, completion %) | ✅ | `GET /projects/:id/metrics`; MetricsTab in ProjectDetail (KPI cards, progress bar, by-status breakdown, cycle time) |
| 11.3 | Cloud mode: auto-select project folder path | 🔲 | Deployment mode flag |
| 11.4 | Self-hosted: folder browser (OS path picker) | 🔲 | — |
| 11.5 | Floating issue panels: Ctrl+click or pop-out icon opens issue in resizable/draggable 500×500 overlay; multiple panels side-by-side, each independently scrollable/editable; panel header shows identifier + close button; panels persist until closed | ✅ | Multi-issue compare; cross-reference while commenting; blocker tracking |

---

## 12. Industry Modules

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12.1 | Call Center module (PBX + AI agents + vector DB) | 🔲 | Large milestone |
| 12.2 | Graphic Design module (ComfyUI, Nanobanana) | ✅ | DB 0061 + shared types/validators + server CRUD + ComfyUI generate (expand+generate) + UI (Overview/Assets studio) + Sidebar gating |
| 12.3 | Social Media module (research, post proposals, account tracking) | ✅ | DB (0056) + shared types/validators + server CRUD routes + UI (Overview/Accounts/Posts/PostDetail) + Sidebar |
| 12.4 | SEO module | ✅ | DB (0057) + shared types/validators + server CRUD routes + UI (Overview/Keywords/Pages) + Sidebar gating |
| 12.5 | Copywriting module | ✅ | DB (0059) + shared types/validators + server CRUD routes + generate-via-Ollama endpoint + UI (Overview/Briefs/BriefDetail) + Sidebar gating |
| 12.6 | Sales / Marketing / Outbound module | ✅ | CRM module: DB migration 0060 (crm_contacts + crm_deals) + shared types/validators + server CRUD routes + UI (Overview/Contacts/Deals kanban) + Sidebar gating (sales/marketing_agency/ecommerce) |
| 12.7 | Software Development / Software Factory module | ✅ | MODULE_GATES["software"] + SoftwareOverview page + sidebar nav gating |
| 12.8 | Civil Engineers / Architects (CAD) module | ✅ | DB schema, shared validators, server CRUD (projects/drawings/specs), full UI with sidebar + module gate |
| 12.9 | PhD Research module (Biology, Astronomy, etc.) | ✅ | DB research_projects/notes/literature (migration 0062) + shared validators + server CRUD + UI (ResearchOverview/ResearchProjects) + sidebar gating |
| 12.10 | MSP and RMM module | ✅ | DB msp_clients/tickets (migration 0062) + shared validators + server CRUD + UI (MspOverview/MspClients/MspTickets) + sidebar gating |

---

## 13. Communications & Collaboration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 13.1 | Zoom / Teams / Slack calling integration | 🔲 | AI voices + avatars |
| 13.2 | In-app voice/video between team members | 🔲 | WebRTC |

---

## 14. Add-ons (SaaS Clones)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 14.1 | GoHighLevel Clone | 🔲 | CRM + marketing automation |
| 14.2 | JustCall.ai Clone | 🔲 | AI-powered call center |
| 14.3 | AI CRM SaaS | 🔲 | — |
| 14.4 | RMM (Remote Monitoring & Management) | 🔲 | — |

---

## 15. Bugs

| # | Bug | Status | Notes |
|---|-----|--------|-------|
| 15.1 | Labels not working; add default labels (feature, bug, QA, testing) | ✅ | `seedDefaultLabels()` in `issueService`; called on company creation; inline edit UI in `IssueProperties` |

---

## Current Sprint (2026-04-26)

Working through these in order:

1. ✅ Sidebar accordion UX (hover chevron, separators, collapse-all toggle)
2. ✅ Sidebar scrollbar theme-aware
3. ✅ Sidebar project + agent star favourites, badge alignment
4. ✅ Email trigger: `→ blocked` issue transition fires `sendBlockedIssueNotification`
5. ✅ UI: `instanceSettingsApi.getNotifications` / `updateNotifications` / `testNotification`
6. ✅ `queryKeys.instance.notificationSettings`
7. ✅ `InstanceNotificationsSettings.tsx` page (SMTP form + test send)
8. ✅ Register Notifications route in `App.tsx` + add `Bell` entry in `InstanceSidebar`
9. ✅ ComfyUI service (`server/src/services/comfyui.ts`)
10. ✅ `POST /agents/:id/generate-avatar` route
11. ✅ `AvatarGeneratorPanel` in AgentDetail config tab
12. ✅ User profile page (`ProfilePage.tsx`, `/profile` route, sidebar footer link)
13. ✅ Sidebar footer: user avatar + name replacing docs link
14. ✅ Version shown in Instance General Settings
15. ✅ Team invite email (fire-and-forget via SMTP)
16. ✅ Copy URL button next to Revoke in pending invitations
17. ✅ Skills list: show key below name (monospace)
18. ✅ Fix labels bug + seed default labels (feature, bug, QA, testing)
19. ✅ Project deadline date picker (1.16)
20. ✅ Bigger project color palette (1.18)
21. ✅ Admin user management page (2.3)
22. ✅ Avatar prompt expansion via Ollama (4.8)
23. ✅ Dashboard: Token Usage by Agent chart (8.1)
24. ✅ Dashboard: Issue Burndown chart (8.3)
25. ✅ Dashboard: Idle Agents Lounge widget (8.4)
26. ✅ Dashboard: Tasks by Agent chart (8.6)
27. ✅ Dashboard: Agent Time Worked chart (8.2)
28. ✅ Agent templates: 12 role presets in NewAgentDialog + NewAgent pre-fill (6.4)
29. ✅ Dashboard widget drag-and-drop + time filter + Customize/Add Widget panel (8.7)
30. ✅ Dashboard: 3 new charts — IssuesByProject, CycleTime, CostTrend (+ server endpoints)
31. ✅ User preferences: timezone, language, email notification opt-outs, digest (2.5); migration 0055
32. ✅ SEO module: DB 0057 + shared types + server routes + UI (Overview/Keywords/Pages) + sidebar gating (12.4)
33. ✅ Social media module: sidebar gating by businessType (12.3 complete)
34. ✅ Copywriting module: DB 0059 + shared types + server CRUD + Ollama generate route + UI (Overview/Briefs/BriefDetail) + sidebar gating + row-title links (12.5)
35. ✅ Avatar panel: 8 styles + temperature slider + ComfyUI checkpoint gate + ordered fallback retry (4.5–4.7)
36. ✅ ModelSettings: Ollama card grid; vLLM GPU server management; OpenCode Go cloud model panel (5.3, 5.7, 5.11)
37. ✅ `GET /models/image-checkpoints` — ComfyUI checkpoint discovery endpoint; avatar panel hidden when none available
38. ✅ CRM module: DB 0060 + shared types/validators + server CRUD (contacts + deals) + UI (Overview/Contacts/Deals kanban) + sidebar gating; fix agent-model save 403 for local_implicit board actor (12.6)
39. ✅ Graphic Design module: DB 0061 + shared types/validators + server CRUD + ComfyUI generate + UI (Overview/Assets studio) + sidebar gating (12.2)
40. ✅ White-label branding: favicon/app icon upload + site title + BrandingInjector at App root + public /instance/branding endpoint (1.20)
41. ✅ OpenAI direct API key: CRUD routes + model discovery with prefix filter + OpenAISection in ModelSettings (5.5)
42. ✅ OpenRouter API key: CRUD routes + model discovery + OpenRouterSection in ModelSettings (5.6)
43. ✅ Vercel AI + Azure OpenAI: CRUD routes + model discovery + VercelAISection + AzureOpenAISection wired; GET /models/all aggregate route; ModelPickerPanel with full multi-provider search + checkboxes + Disable Pro+ (5.8, 5.9)
44. ✅ Skill catalog discovery in NewAgent: search + category filter + Install + auto-select (6.2)
45. ✅ Auto-generate skill with AI: bundled SKILL.md template + server Ollama endpoint + Generate UI in NewAgent (6.3)
46. ✅ Dashboard time-range filter: `days` param wired into tasksByAgent + projectHealth (server routes/services + API client + Dashboard queries)
47. ✅ Floating issue panels: Ctrl+click or pop-out icon opens draggable/resizable 500×500 overlay per issue; multiple panels side-by-side; panel header with identifier + close (11.5)
48. ✅ Sprints module: DB sprints table + sprintId FK on issues (migration 0063) + shared validators + server CRUD + velocity endpoint + Ollama AI report + Sprints.tsx UI (10.1)
49. ✅ Civil Engineering module: DB civil_projects/drawings/specs (migration 0063) + shared validators + server CRUD + full UI + sidebar gating (12.8)
50. ✅ Shared ColorPicker component: swatch + hex input; adopted in ProjectDetail, Departments, IssueProperties, LabelSettings
51. ✅ Department MCP defaults: mcpKeys jsonb column (migration 0064) + "Default MCPs" tab + DepartmentSuggestedMcps (7.2)
52. ✅ Dockerfile MCP pre-install + seed-mcps.ts idempotent seeder: Web Fetch (mcp-fetch) + Filesystem defaults (7.3)
53. ✅ DevOps MCP catalog entries: GitLab (7.6), Azure DevOps (7.4), BitBucket (7.5); fix web-fetch to use mcp-fetch; remove nonexistent languagetool/pandoc packages
