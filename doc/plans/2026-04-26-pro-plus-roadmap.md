# Paperclip Pro+ Roadmap

> **Vision**: Turn Paperclip into a full-featured, white-label AI Business Platform — self-hosted or cloud — with industry-specific modules, rich UI/UX, and enterprise-grade extras.
>
> **Status key**: ✅ Done · 🔄 In progress · 🔲 Not started · ❌ Blocked · 🚧 WORK IN PROGRESS
>
> **Active batches (branched & PR'd)**:
> - `feat/agent-observability` — Agent live feed improvements (17.5, 8.x) → PR [#4](https://github.com/ccasalicchio/paperclip-surfers/pull/4)
> - `feat/ui-tooltip-replacement` — Native title→Tooltip migration (1.21) → PR [#3](https://github.com/ccasalicchio/paperclip-surfers/pull/3)
> - `feat/messaging-integrations` — Telegram/WhatsApp outbound + inbound (13.x) → PR [#1](https://github.com/ccasalicchio/paperclip-surfers/pull/1)
> - `feat/dashboard-auto-refresh` — Configurable dashboard polling + countdown → PR [#2](https://github.com/ccasalicchio/paperclip-surfers/pull/2)

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
| 1.21 | Replace native `title=` tooltips with custom Tooltip component | 🔄 | In progress — Dashboard, IssueDetail, Agents, AgentDetail, TeamMembers, ModelSettings, OrgChart, Sprints |

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
| 6.6 | Company memory bank + MemPalace / vector DB | 🔲 | See Section 24 — full implementation plan; ChromaDB (Section 23) is the vector store backend |

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
| 15.2 | BurndownChart bars render top-down instead of bottom-up after `flex-col-reverse` refactor | 🔲 | `ActivityCharts.tsx:385` — "Opened" at bottom, "Closed" on top, opposite of standard burndown convention; verify intentional |
| 15.3 | WhatsApp inbound webhook missing — outbound dispatch references it but no route or Meta hub.challenge handler exists | 🔲 | `server/src/services/messaging/dispatch.ts:70,88,110,128` |
| 15.4 | `sendInviteEmail` ignores `notifications.enabled` — invite emails fire even when email notifications disabled globally | 🔲 | `server/src/services/email.ts:285-286`; add `if (!notifications.enabled) return;` guard |
| 15.5 | WhatsApp outbound dispatch also broken — no Cloud API client in `messaging/`; outbound silently no-ops for WhatsApp configs | 🔲 | `server/src/services/messaging/dispatch.ts`; remove WhatsApp from provider enum until implemented, or finish the Cloud API client |
| 15.6 | `cron.ts` (373 lines, `nextOccurrence()` parser) appears unconsumed — no scheduler loop calls it; routines may silently not fire | 🔲 | `server/src/services/cron.ts`; audit all callers, either wire into scheduler or delete |
| 15.7 | `companies.status = 'archived'` has no sweep job, no UI flag, and no agent-pause on archive — archiving does nothing observable | 🔲 | Add archive sweep: pause all child agents, hide from sidebar; `server/src/services/companies.ts` |
| 15.8 | Telegram webhook puts company UUID in URL — even after adding secret validation, the UUID is guessable and enables company enumeration via side-channel DB lookups | 🔲 | `server/src/routes/telegram-webhook.ts`; switch to opaque per-company webhook tokens (not the company UUID) |
| 15.9 | No e2e test coverage for cost → budget hard-stop → auto-pause loop — the most safety-critical invariant in the system | 🔲 | `tests/e2e/budget-hardstop.spec.ts` (new); SPEC §17.3 requires this |

---

## 16. Security & Hardening

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| 16.1 | Telegram webhook has no cryptographic secret validation — any caller who discovers the URL can drive it | Critical | 🔲 | `server/src/routes/telegram-webhook.ts:27-48`; validate `X-Telegram-Bot-Api-Secret-Token` header (constant-time) before any DB work; store secret alongside `botToken` in `messagingProviders.config` |
| 16.2 | `POST /models/install` and `DELETE /models/ollama/:modelName` have no authentication — any unauthenticated caller can install or delete Ollama models | Critical | 🔲 | `server/src/routes/models.ts:213,225`; apply `assertModelAdmin(req)` |
| 16.3 | `GET /models/vllm/endpoints` returns plaintext vLLM API keys | Critical | 🔲 | `server/src/routes/models.ts:232-237`; redact `apiKey` before response (mask to last 4 chars like other providers) |
| 16.4 | Multiple unauthenticated model routes (`/models/available`, `/models/installed`, `/models/all`, `/models/openai/models`, `/models/openrouter/models`, `/models/image-checkpoints`) | Critical | 🔲 | `server/src/routes/models.ts`; apply `assertBoard(req)` or `assertModelAdmin(req)` to all discovery routes |
| 16.5 | Email HTML templates inject unescaped user-controlled values (`issue.title`, `invite.companyName`, `acceptLink`, `resetUrl`) | Critical | 🔲 | `server/src/services/email.ts:193,240,310-311,417-419,473-475`; import and apply `esc()` from `email-layouts.ts` to all dynamic strings |
| 16.6 | `llmRoutes` mounted before `/api` auth middleware, bypassing `boardMutationGuard` | Warning | 🔲 | `server/src/app.ts:185`; move `llmRoutes` inside the `api` router under `/api/llms/…` |
| 16.7 | Telegram `/complete` command skips activity log and approval gates — direct DB mutation with no audit trail | Warning | 🔲 | `server/src/routes/telegram-webhook.ts:129-157`; add activity log write after status update; respect approval gates |
| 16.8 | N+1 queries in `PATCH /companies/:companyId/agents/models` — 2×N sequential DB round-trips, no array size limit | Warning | 🔲 | `server/src/routes/models.ts:336-350`; batch reads with `inArray`; add max-length guard on `updates` array |
| 16.9 | `log-redaction.ts` only redacts filesystem paths, not API key patterns — keys echoed in agent stderr pass through to run logs unredacted | Minor | 🔲 | `packages/adapter-utils/src/log-redaction.ts`; add regex redaction for `sk-[A-Za-z0-9]{20,}`, `sk-or-[A-Za-z0-9]{20,}`, `AIza[A-Za-z0-9-_]{35}` patterns |
| 16.10 | CSRF protection absent — `better-auth.ts` uses board cookies but no csurf/double-submit-token middleware on state-changing endpoints | Critical | 🔲 | `server/src/app.ts` middleware chain; SPEC §16 explicitly requires CSRF protection |
| 16.11 | Plugin sandbox escape risk — `plugin-runtime-sandbox.ts` runs script eval in Node; no prototype-pollution audit, no SHA-pinning or signature verification on plugin install | Warning | 🔲 | `server/src/services/plugin-runtime-sandbox.ts`; audit + add SHA-pin to plugin-loader.ts |
| 16.12 | Webhook delivery / mcp-fetch URLs not SSRF-protected — user-supplied URLs can target 169.254.169.254, RFC 1918 ranges, metadata services | Warning | 🔲 | `server/src/utils/safe-fetch.ts` (new); block link-local + RFC 1918 before any user-supplied URL fetch |
| 16.13 | 2FA schema (`two_factor` table) exists but enrollment, recovery codes, and enforcement on board mutations are not implemented | Warning | 🔲 | `server/src/auth/2fa.ts`; finish enrollment flow + require on sensitive mutations |
| 16.14 | No machine-verified company-boundary test — 47 route files claim company-scoping but no fuzz test asserts agent keys can't read sibling company data | Warning | 🔲 | `server/src/__tests__/company-boundary-fuzz.test.ts` (new); CLAUDE.md invariant: "Agent API keys must not cross companies" |
| 16.15 | `POST /cost-events` accepts client-supplied `costCents` — a compromised agent can under-report cost to evade budget caps | Warning | 🔲 | `server/src/routes/cost-events.ts`; add server-side model pricing lookup to verify or override client value (see 20.3) |

---

## 17. Agent Reliability & Observability

| # | Task | Status | Notes |
|---|------|--------|-------|
| 17.1 | Run replay — re-run any past `heartbeat_run` from its `context_snapshot` against a different model; diff outcome vs original | 🔲 | `server/src/services/agent-runtime/replay.ts` (new); route `POST /heartbeat-runs/:id/replay`; UI in AgentDetail performance tab |
| 17.2 | Run trace waterfall — per-run flame graph of phases (context build → adapter invoke → tool calls → cost events → status writes) | 🔲 | `RunTimelineView.tsx` (new); `heartbeat_run_events` table already exists; mostly aggregation query + UI |
| 17.3 | Stuck-run watchdog → auto-incident — detect and surface stuck runs as first-class incidents with severity, on-call assignment, auto-pause | 🔲 | `server/src/services/heartbeat-watchdog.ts` (new); tie into `budget_incidents` pattern |
| 17.4 | Cost anomaly detection — per-agent rolling baseline; alert + auto-pause when run exceeds `mean + 3σ` or absolute ceiling | 🔲 | `server/src/services/budgets.ts`; add "spike" incident type |
| 17.5 | Live token-stream view per active run — WebSocket-streamed token-by-token transcript of current invocation | 🔄 | ActiveAgentsPanel auto-expand + inline activity preview; RunListItem current-step indicator; `latestActivityPreview()` helper |
| 17.6 | Agent eval harness with regression baselines — golden tasks per agent role; auto-run on config change, diff vs baseline before promotion | 🔲 | `server/src/services/agent-runtime/post-run-eval.ts` (stub exists); `agent_evals` table + UI in AgentPerformanceTab |
| 17.7 | Refactor `heartbeat.ts` (4,250 lines) into `server/src/services/agent-runtime/` modules — context build, adapter invocation, scheduler, retry, cancel, run-log each in their own file | 🔲 | Mechanical extraction; `agent-runtime/` seams already exist (`session-resolver.ts`, `mcp-resolver.ts`) |
| 17.8 | Model pricing catalog — `model_pricing` table with per-token rates per provider/model; cost events verified server-side | 🔲 | New schema + `server/src/services/pricing.ts`; pricing seed refreshed nightly via cron (closes 16.15) |
| 17.9 | "Say Hello" response display — when clicking "Say Hello" on the Agents page, each agent's greeting response appears inline next to the agent's name and avatar card (instead of a generic toast or separate page) | 🔲 | `ui/src/pages/Agents.tsx`; map agent ID → response text in state; render response bubble below each agent card; auto-clear after 10s |

---

## 18. Enterprise & SaaS

| # | Task | Status | Notes |
|---|------|--------|-------|
| 18.1 | SSO — SAML 2.0 + OIDC via Better Auth plugins; per-instance IdP config, JIT user provisioning, group → role mapping | 🔲 | `server/src/auth/sso/` (new); UI page under InstanceSettings; Better Auth has plugins for both |
| 18.2 | SCIM 2.0 user/group provisioning — Okta/Entra/Google Workspace push/pull → company memberships | 🔲 | `server/src/routes/scim.ts` (new); reuses `instance_user_roles` + `company_memberships` |
| 18.3 | Tamper-evident audit log export — chain-hash every `activity_log` row; verifiable NDJSON/CEF export for SIEM | 🔲 | `activity_log` + `prev_hash` + `row_hash` columns; `GET /companies/:id/activity/export?format=cef`; SOC 2 control |
| 18.4 | Outbound webhooks with HMAC signing — subscribe external systems (ServiceNow/Datadog/PagerDuty) to `issue.*`, `agent.*`, `approval.*`, `budget.incident.*` events | 🔲 | `server/src/services/outbound-webhooks.ts` (new); retries + dead-letter + replay UI; reuse `pluginWebhookDeliveries` schema as template |
| 18.5 | PII scrubber for logs and run transcripts — pluggable redactor for emails, phones, credit cards, SSNs; per-company opt-in | 🔲 | Extend `packages/adapter-utils/src/log-redaction.ts`; critical for HIPAA/GDPR (Call Center 12.1, MSP 12.10) |
| 18.6 | Secret rotation API + scheduled rotation — `POST /companies/:id/secrets/:name/rotate`; grace-period rollback | 🔲 | `server/src/services/secrets.ts` (extend); SOC 2 required |
| 18.7 | Per-tenant rate limiting middleware on `/api/*` keyed by company + actor type | 🔲 | `server/src/middleware/rate-limit.ts` (new); in-memory Map or Redis; SPEC §16 requires it |
| 18.8 | Per-company data residency + encryption-at-rest mode — column-level encryption with per-company KEK; region-pinned asset storage | 🔲 | `companies` + `data_region` + `kek_id`; `server/src/services/encryption.ts` (new); EU/healthcare buyers |

---

## 19. Monetization & Multi-Tenant SaaS

| # | Task | Status | Notes |
|---|------|--------|-------|
| 19.1 | Stripe billing integration — per-instance subscription; tiered pricing on active agents + included tokens + overage; surfaces in InstanceSettings | 🔲 | `server/src/services/billing-stripe.ts` + `BillingSettings.tsx`; required before any cloud launch |
| 19.2 | Usage metering pipeline — roll up `cost_events` into Stripe metered-billing or internal counter; per-tenant rate limits | 🔲 | `server/src/services/usage-metering.ts`; required for SaaS clone billing (14.x) |
| 19.3 | Module license keys — `module_licenses` table; per-company license check in module gate; ship CRM/SEO/Design as paid add-ons | 🔲 | New table + `useModuleLicense()` hook; sidebar gating already exists per-module |

---

## 20. Developer Experience & Plugin Ecosystem

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20.1 | Plugin marketplace ("ClipHub") MVP — static index of `@paperclipai/plugin-*` packages with version pinning + signature verification | 🔲 | `cli/src/commands/plugin.ts` + `ui/src/pages/PluginMarketplace.tsx`; plugin SDK already mature |
| 20.2 | Adapter authoring kit — `paperclipai create-adapter <name>` scaffolds new adapter, wires into registry, emits test fixture | 🔲 | `cli/src/commands/create-adapter.ts` |
| 20.3 | OpenAPI 3.1 spec generation + typed `@paperclipai/sdk` npm package + Swagger UI at `/api/docs` | 🔲 | `packages/sdk-codegen` (new); generate from existing Zod validators in `packages/shared` |
| 20.4 | Demo seed command — `paperclipai demo seed` populates a company with CEO, CTO, engineers, in-progress issues, fake cost history, pending approval | 🔲 | `cli/src/commands/demo.ts` + `cli/fixtures/demo-company.json`; cheapest sales tool available |
| 20.5 | `paperclipai doctor` — checks DB connection, migration parity, model provider keys, MCP servers reachable, ComfyUI/Ollama health | 🔲 | `cli/src/commands/doctor.ts` |
| 20.6 | `paperclipai backup` / `restore` — dumps PGlite + assets to tar.gz; inverse restore; prevents data loss for self-hosters | 🔲 | `cli/src/commands/backup.ts` |

---

## 21. Missing Industry Modules

| # | Module | Status | Notes |
|---|--------|--------|-------|
| 21.1 | Legal / Contract Lifecycle — contract intake → redline → approval → e-sign → renewal calendar; "Junior Associate" agent role | 🔲 | DB `legal_contracts/clauses/signatures`; high-value vertical for autonomous agent upsell |
| 21.2 | Healthcare / Clinic Ops — patient intake, appointment routing, prior-auth checking; HIPAA-mode logging | 🔲 | Requires 18.5 (PII scrubber) + 18.8 (data residency) first |
| 21.3 | Accounting / Bookkeeping — receipts in → categorization → ledger entries → month-end close report | 🔲 | `finance.ts` service exists as cost rollup; extend to full double-entry |
| 21.4 | Recruiting / ATS — JD → sourcing → outreach → screen → schedule; reuses CRM contacts table | 🔲 | DB `ats_jobs/candidates/pipeline`; sidebar gate `recruiting` |
| 21.5 | Customer Support / Helpdesk — email-in / ticket triage → auto-reply → human handoff; pairs with Telegram/WhatsApp messaging | 🔲 | DB `support_tickets/responses`; sidebar gate `support` |

---

## 22. Quality of Life

| # | Task | Status | Notes |
|---|------|--------|-------|
| 22.1 | i18n scaffold — `react-i18next` wiring + translation files; user language preference already stored (2.5) but no translations rendered | 🔲 | `ui/src/i18n/` (new); `<I18nextProvider>` wrapper; white-label customers in non-English markets require this |
| 22.2 | Org-chart PNG/SVG export — "Download as PNG" button in `OrgChart.tsx`; embed in sprint reports | 🔲 | `org-chart-svg.ts` route already exists; S effort |
| 22.3 | "What is everyone doing right now?" Cmd-K command — scrolls through every agent's `latest_run` summary as a 30-second TV-wall view | 🔲 | Extend `CommandPalette.tsx`; fits GOAL.md "understand your entire company at a glance" |
| 22.4 | Consolidate auth directory — `server/src/auth/` has only `better-auth.ts`; logic for `instance_user_roles`, `two_factor`, `cli_auth_challenges`, `board_api_keys` scattered across routes/services | 🔲 | Mechanical extraction into `server/src/auth/` modules |
| 22.5 | Full-screen dashboard mode — dedicated `/dashboard/fullscreen` route at 100vh with no scrolling; auto-sizes widgets to fill viewport; hides sidebar, header, and nav; shows only key live stats (active agents, live runs, open issues, cost today, burndown); ideal for wall-mount TV displays | 🔲 | New `DashboardFullscreen.tsx` page; reuses existing widget components with a compact/fill layout variant; toggle via `F` keyboard shortcut or button in Dashboard header |

---

## 23. Knowledge Base & Agent Training (ChromaDB)

> **Vision**: Companies can upload markdown files (SOPs, wikis, product docs, code references) that are chunked, embedded, and stored in ChromaDB. Agents query the KB via semantic search during every run, grounding their responses in company-specific knowledge rather than just general training. Two storage modes: **self-hosted** (shared host volume — data survives container recreation) and **cloud** (named Docker volume — fully containerized, no host path required).

### 23a. Infrastructure

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.1 | Add ChromaDB service to `docker-compose.yml` — standalone container mode with health check | 🔲 | `chromadb/chroma:latest`; `CHROMA_HOST=http://chroma:8000`; `ALLOW_RESET=true` for dev; port 8000 internal only (not exposed to host) |
| 23.2 | Self-hosted storage profile — mount `${PAPERCLIP_CHROMA_DIR:-${HOME}/.paperclip/chroma}:/chroma/chroma` so KB data persists on host across container rebuilds | 🔲 | Default for self-hosted (`PAPERCLIP_DEPLOYMENT_MODE=local_trusted`); user can override `PAPERCLIP_CHROMA_DIR` in `.env` |
| 23.3 | Cloud storage profile — named Docker volume `chromadb-data:/chroma/chroma` with no host mount; data lives fully inside container stack | 🔲 | Default when `PAPERCLIP_DEPLOYMENT_MODE=authenticated` and `PAPERCLIP_CHROMA_CLOUD=true`; volume backed up by existing backup service |
| 23.4 | Add `CHROMA_HOST` env var to server container; graceful startup skip if Chroma unreachable (KB features degraded, not fatal) | 🔲 | `server/src/config.ts`; log warning "ChromaDB not available — knowledge base features disabled" |
| 23.5 | Install ChromaDB JS client in server package: `chromadb` npm package | 🔲 | `server/package.json`; singleton client in `server/src/services/chroma-client.ts` |

### 23b. Database Schema

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.6 | `knowledge_bases` table — per-company KB registry (`id`, `company_id`, `name`, `description`, `chroma_collection_name`, `embedding_model`, `created_at`, `updated_at`) | 🔲 | Migration 0065+; one company can have multiple named KBs (e.g. "Product Docs", "Codebase", "SOPs") |
| 23.7 | `knowledge_documents` table — tracks every uploaded file (`id`, `kb_id`, `company_id`, `filename`, `file_size`, `chunk_count`, `embed_model`, `status` [pending/processing/ready/failed], `error`, `uploaded_by`, `created_at`) | 🔲 | Status field drives ingestion pipeline; `chunk_count` records how many Chroma vectors were produced |
| 23.8 | `agent_knowledge_bases` junction table — which KBs each agent can query during runs (`agent_id`, `kb_id`, `priority`) | 🔲 | Agents inherit company-default KB if no override; `priority` controls retrieval order when multiple KBs assigned |

### 23c. Ingestion Pipeline

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.9 | Markdown chunker service — splits uploaded `.md` files into overlapping chunks (512 tokens, 64-token overlap) preserving heading context; strips YAML frontmatter | 🔲 | `server/src/services/knowledge/chunker.ts`; use `markdown-it` for structure-aware splitting (headings become chunk metadata) |
| 23.10 | Embedding service — converts chunks to float32 vectors via Ollama `nomic-embed-text:latest` (already in opencode config); fallback to OpenAI `text-embedding-3-small` if Ollama unavailable | 🔲 | `server/src/services/knowledge/embedder.ts`; batch requests 32 chunks at a time; stores model name with each vector in Chroma metadata |
| 23.11 | Ingestion worker — background job that picks up `status=pending` documents, runs chunker → embedder → upsert to Chroma collection, updates status to `ready` or `failed` | 🔲 | `server/src/services/knowledge/ingest-worker.ts`; polled every 10s by heartbeat scheduler; idempotent (uses `document_id+chunk_idx` as Chroma IDs so re-ingestion is safe) |
| 23.12 | Re-ingestion on model change — when a KB's `embedding_model` is updated, mark all its documents `pending` to trigger re-embedding with the new model | 🔲 | Ensures vector space stays consistent; `server/src/services/knowledge/kb-service.ts` |
| 23.13 | Support additional file types: `.txt`, `.mdx`, `.rst`, `.pdf` (pdf via `pdf-parse`) | 🔲 | Extend chunker with per-type parser; PDF support unlocks legal, research, and compliance use cases |

### 23d. Query & Retrieval

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.14 | `POST /companies/:id/knowledge-bases/:kbId/query` — semantic search endpoint; accepts `{ query: string, topK?: number, filter?: object }`; returns ranked chunks with source doc + heading path + relevance score | 🔲 | `server/src/routes/knowledge-bases.ts`; calls Chroma `collection.query()`; company-scoped collection names prevent cross-tenant leakage |
| 23.15 | Knowledge base MCP tool — `search_knowledge_base(query, kb_name?, top_k?)` tool injected into agent skill bundles; agents can call it during runs to retrieve grounding context | 🔲 | `packages/plugins/sdk` or `server/src/services/company-skills.ts`; auto-injected for agents with KB assignments |
| 23.16 | Context injection into heartbeat runs — when a run starts, pre-fetch top-5 chunks from assigned KBs matching the current issue title + description; prepend as `<knowledge>` block in agent system prompt | 🔲 | `server/src/services/heartbeat.ts` context-build phase; makes KB passive (no tool call required) |
| 23.17 | Hybrid search — combine Chroma vector search with Postgres full-text search on `knowledge_documents.filename` + chunk text (BM25); merge-rank results via Reciprocal Rank Fusion | 🔲 | Improves recall for exact term searches (version numbers, function names) that embeddings miss |

### 23e. UI

| # | Task | Status | Notes |
|---|------|--------|-------|
| 23.18 | Knowledge Bases list page — per-company KB management: create/rename/delete KBs, see document count + status badges, total vector count | 🔲 | `ui/src/pages/KnowledgeBases.tsx`; sidebar entry gated by `CHROMA_HOST` availability |
| 23.19 | Document upload UI — drag-and-drop markdown file uploader with multi-file support; shows ingestion progress (pending → processing → ready); re-upload/delete individual files | 🔲 | `ui/src/pages/KnowledgeBaseDetail.tsx`; `POST /companies/:id/knowledge-bases/:kbId/documents` with multipart upload |
| 23.20 | KB search playground — inline search box in `KnowledgeBaseDetail`; shows top-K results with chunk text, source file, relevance score; useful for testing KB quality before assigning to agents | 🔲 | Calls `23.14` endpoint; renders results as expandable cards |
| 23.21 | Agent KB assignment UI — checklist of available KBs in `AgentDetail` config tab; drag to reorder priority | 🔲 | Updates `agent_knowledge_bases` junction table |
| 23.22 | KB health indicator on agent card — small "KB" badge on agent sidebar/org-chart card when agent has KBs assigned; orange if any document in `failed` status | 🔲 | `AgentIcon.tsx` or `SidebarAgents.tsx` |

### 23f. docker-compose Changes (summary)

```yaml
# Add to services:
chroma:
  image: chromadb/chroma:latest
  environment:
    - IS_PERSISTENT=TRUE
    - ALLOW_RESET=TRUE          # disable in prod
  volumes:
    # Self-hosted mode (default): shared with host
    - ${PAPERCLIP_CHROMA_DIR:-~/.paperclip/chroma}:/chroma/chroma
    # Cloud mode: swap above line for named volume below
    # - chromadb-data:/chroma/chroma
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
    interval: 5s
    retries: 10
  networks:
    - default

# Add to server environment:
CHROMA_HOST: "http://chroma:8000"

# Add to server depends_on:
chroma:
  condition: service_healthy

# Add to volumes (for cloud mode):
chromadb-data:
```

---

## 24. MemPalace — Agent Memory Optimization

> MemPalace is Paperclip's native implementation of the `MemoryAdapter` contract (`doc/plans/2026-03-17-memory-service-surface-api.md`). It gives every agent a persistent, queryable memory built on ChromaDB (Section 23) + `nomic-embed-text` embeddings. Agents auto-ingest past runs, issue comments, and uploaded documents, then receive the most relevant context injected into every new run prompt.

### 24a. Phase 1 — Control-Plane Contract

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.1 | `memory_bindings` table — columns: `id`, `companyId`, `agentId?`, `projectId?`, `issueId?`, `scope` (company/agent/project/issue), `providerKind` (chroma/markdown/external), `config` jsonb, `enabled`, `createdAt` | 🔲 | Migration 0070+; Drizzle schema in `packages/db/src/schema/memory.ts` |
| 24.2 | `memory_binding_targets` table — maps a binding to the agents/projects it applies to (M2M); columns: `bindingId`, `targetKind`, `targetId` | 🔲 | Same migration; enables company-wide vs agent-scoped bindings |
| 24.3 | `memory_operations` table — audit log for every memory read/write; columns: `id`, `bindingId`, `agentId?`, `runId?`, `issueId?`, `op` (write/query/forget), `tokensUsed`, `latencyMs`, `createdAt` | 🔲 | Enables cost tracking + replay debugging |
| 24.4 | `MemoryAdapter` TypeScript interface in `packages/shared` — `write()`, `query()`, `get()`, `forget()`; `MemoryScope`, `MemorySourceRef`, `MemoryWriteRequest`, `MemoryQueryRequest`, `MemoryContextBundle`, `MemorySnippet` types | 🔲 | Matches spec in `doc/plans/2026-03-17-memory-service-surface-api.md`; exported from `@paperclipai/shared` |
| 24.5 | Memory provider registry in server — `server/src/services/memory-registry.ts`; maps `providerKind` → concrete adapter instance; plugin adapters self-register via `POST /plugins/:id/register-memory` | 🔲 | Decoupled from ChromaDB so future providers (S3, Notion, etc.) can slot in |
| 24.6 | REST CRUD for memory bindings — `GET/POST /companies/:id/memory-bindings`, `GET/PATCH/DELETE /companies/:id/memory-bindings/:bindingId` | 🔲 | Board-auth only; validates `providerKind` is registered |

### 24b. Phase 2 — Built-in ChromaDB Provider (MemPalace Core)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.7 | `ChromaMemoryAdapter` class — implements `MemoryAdapter`; uses `chromadb` npm client pointing at `CHROMA_HOST`; embedding via `nomic-embed-text` through Ollama (`OLLAMA_HOST`) | 🔲 | `server/src/services/memory/chroma-adapter.ts`; graceful no-op when `CHROMA_HOST` unset |
| 24.8 | Collection naming convention — `mp_{companyId}_{scope}` where scope is `company`, `agent_{agentId}`, `project_{projectId}`, or `issue_{issueId}` | 🔲 | Prevents cross-company data leaks; created lazily on first write |
| 24.9 | `write()` implementation — chunks text > 512 tokens with 64-token overlap; generates embeddings; upserts to Chroma; writes `memory_operations` audit row | 🔲 | Uses `langchain/text_splitter` or hand-rolled splitter (no LangChain dep) |
| 24.10 | `query()` implementation — embed query string; Chroma `query()` with top-K; returns `MemoryContextBundle` with `snippets[]` sorted by relevance; respects `minScore` threshold | 🔲 | Default top-K=5; configurable per binding via `config.topK` |
| 24.11 | `forget()` implementation — deletes Chroma documents by `sourceRef` metadata filter; writes forget audit row | 🔲 | Required for GDPR/right-to-forget compliance |
| 24.12 | Markdown-file provider (fallback) — `MarkdownMemoryAdapter`; reads `~/.paperclip/memory/*.md`; uses simple TF-IDF similarity when Chroma unavailable | 🔲 | `server/src/services/memory/markdown-adapter.ts`; activated when `CHROMA_HOST` unset |

### 24c. Phase 3 — UI Inspection & Management

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.13 | Company Memory Settings page — list all `memory_bindings` for a company; toggle enabled/disabled; show `providerKind` badge + scope tags | 🔲 | `ui/src/pages/MemorySettings.tsx`; sidebar entry under Instance Settings |
| 24.14 | Create/edit memory binding dialog — select scope (company/agent/project/issue), provider (chroma/markdown), topK, minScore, enabled sources | 🔲 | `MemoryBindingDialog.tsx` |
| 24.15 | Agent Memory tab in AgentDetail — shows bindings that apply to this agent; lists recent memory operations (last 50 queries/writes) with latency + tokens | 🔲 | New "Memory" tab in `AgentDetail.tsx`; calls `/companies/:id/memory-bindings?agentId=X` + `/memory-operations?agentId=X` |
| 24.16 | Memory operations explorer — filterable table: op type, run link, issue link, latency, tokens, timestamp; click row shows the snippet(s) returned | 🔲 | `ui/src/pages/MemoryOperations.tsx`; linked from agent Memory tab and Company Memory Settings |
| 24.17 | Memory snippet browser — per-binding view of all stored chunks; search box + delete individual chunks | 🔲 | Calls `GET /companies/:id/memory-bindings/:bindingId/snippets?q=&limit=50`; uses Chroma `query()` or `get()` |

### 24d. Phase 4 — Automatic Hooks (Passive Learning)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.18 | Pre-run hydration hook — before agent run starts, `query()` all active bindings for context related to the current issue title + description; inject `MemoryContextBundle` into system prompt as `## Relevant Context` block | 🔲 | `server/src/services/heartbeat.ts` `buildSystemPrompt()`; no-op when no bindings or Chroma down |
| 24.19 | Post-run capture hook — after run succeeds, `write()` the run's final summary (extracted from last assistant turn or tool output) tagged with `sourceRef: { kind: 'run', id: runId }` | 🔲 | `heartbeat.ts` run completion path; configurable via binding `config.captureRuns: true` |
| 24.20 | Issue comment capture — when a human adds a comment to an issue (`POST /issues/:id/comments`), auto-write to company-scoped binding tagged `sourceRef: { kind: 'issue_comment', id: commentId }` | 🔲 | `server/src/routes/issues.ts` comment handler; only if company has a `scope: company` binding with `captureComments: true` |
| 24.21 | Document upload hook — files ingested via KB upload (Section 23) also feed the agent-scope binding for any agent assigned to that KB | 🔲 | `23.13` ingestion job triggers `write()` on all bound agent collections in parallel |
| 24.22 | Memory size guard — before each `write()` check `MemoryUsage`; if company exceeds soft limit (100k chunks default), emit warning notification; if hard limit (500k), reject write + notify admin | 🔲 | `getUsage()` on `ChromaMemoryAdapter`; limits configurable in `memory_bindings.config` |

### 24e. Phase 5 — Rich Capabilities

| # | Task | Status | Notes |
|---|------|--------|-------|
| 24.23 | Memory correction flow — agent or human can submit a correction: `POST /companies/:id/memory-bindings/:bindingId/corrections` with `original` + `corrected` text; old chunk deleted, new chunk written with `sourceRef.kind: 'correction'` | 🔲 | UI: "Correct this memory" action on each snippet in Memory Snippet Browser (24.17) |
| 24.24 | Evaluation dashboard — shows precision@K and recall@K estimates by comparing memory snippets retrieved during runs vs. the actual run outcome (succeeded/failed) | 🔲 | `ui/src/pages/MemoryEvaluation.tsx`; runs nightly batch job `POST /memory/eval` that samples last 100 queries |
| 24.25 | Memory import: agent-to-agent transfer — copy all memory from one agent's collection to another; useful when cloning agents or promoting a prototype | 🔲 | `POST /companies/:id/memory-bindings/:bindingId/copy-to?targetAgentId=X` |
| 24.26 | Scheduled memory summarization — cron job (weekly) that clusters + summarizes all snippets older than 30 days into a single condensed "long-term summary" chunk, then deletes the originals | 🔲 | Reduces Chroma collection size; uses Ollama default model for summarization; configurable retention days |
| 24.27 | Plugin-provided memory adapters — third-party plugins can register a custom `MemoryAdapter` via the plugin SDK `registerMemoryProvider()` hook; appears as a selectable `providerKind` in the UI | 🔲 | `packages/plugins/sdk/src/memory.ts`; server validates adapter implements full interface before accepting registration |

---

## 25. Embedded VS Code (Code Review & Issue Completion)

> Embed a rebranded VS Code (via the `code-server` open-source project or the `@vscode/vscode-web` web bundle) directly inside Paperclip so users can review agent-generated code diffs, edit files, and even complete issues themselves — all without leaving the app. Fork and rebrand with the app title, icon, and theme.

### 25a. Forking & Rebranding

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25.1 | Fork `cdr/code-server` under SplatDev; rebrand: replace VS Code logo/title with Paperclip app icon + site title (pulled from instance branding settings) | 🔲 | Fork at `github.com/splatdev/code-server`; branding injected via `product.json` overrides at build time |
| 25.2 | Build pipeline: GitHub Actions workflow that builds `code-server` Docker image tagged `paperclipai/code-server:{version}`; pushed to registry on release | 🔲 | Parameterized by `APP_NAME`, `APP_ICON_URL`, `APP_VERSION`; artefact reused by docker-compose |
| 25.3 | White-label product.json — set `nameLong`, `nameShort`, `applicationName`, `dataFolderName`, `extensionAllowedProposedApi` from Paperclip branding at build time | 🔲 | `product.json` is the canonical VS Code branding override file |

### 25b. Infrastructure

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25.4 | `code-server` docker-compose service — image: `paperclipai/code-server:latest`; port 8080 (internal); bind-mount the agent workspace volume; env: `PASSWORD` / `PAPERCLIP_TOKEN` for SSO | 🔲 | Add to `docker-compose.yml`; gated by `ENABLE_CODE_SERVER=true` |
| 25.5 | Auth proxy: Paperclip server validates session cookie/JWT and forwards requests to code-server via reverse proxy at `/code/` — no separate login | 🔲 | `server/src/routes/code-server-proxy.ts`; strips auth headers before forwarding; only board-authenticated users reach it |
| 25.6 | Workspace isolation per agent — each agent's workspace is a separate sub-directory (or Docker volume mount) so users can browse `agent_{agentId}/` folder trees | 🔲 | Code-server `--workspace-dir` argument driven by query param `?agentId=X` validated server-side |

### 25c. Issue Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25.7 | "Open in Editor" button on issue detail page — opens code-server in a new panel/tab pre-focused on the workspace diff for that issue's last run | 🔲 | Button visible when `ENABLE_CODE_SERVER` and issue has at least one run with file changes; links to `/code/?issueId=X` |
| 25.8 | Issue context sidebar extension — a VS Code extension (packaged inside the fork) that shows the current Paperclip issue title, description, acceptance criteria, and linked runs in a sidebar panel | 🔲 | Extension at `extensions/paperclip-issue-context`; reads issue data from Paperclip REST API using a token injected via env |
| 25.9 | "Complete issue from editor" action — VS Code command palette entry "Paperclip: Mark Issue Done" that calls `PATCH /issues/:id/status` to `done` and optionally triggers a final agent review run | 🔲 | Registered in extension `package.json` contributes.commands |
| 25.10 | Run diff viewer — when a run produces file changes, generate a unified diff stored in `run_artifacts`; "View Diff" button opens code-server diff editor on that artifact | 🔲 | `server/src/services/runs.ts` post-run step; artifact kind `diff`; code-server opened with `vscode://vsdiff?...` URI |

### 25d. Embedded UI Panel

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25.11 | Full-screen code editor page — `/editor` route in React app; renders code-server in a full-height `<iframe>`; header shows Paperclip nav + issue breadcrumb | 🔲 | `ui/src/pages/CodeEditor.tsx`; sidebar entry "Editor" gated by `ENABLE_CODE_SERVER` |
| 25.12 | Floating editor panel — same as floating issue panels (11.5 pattern); Ctrl+click or "Pop out" on "Open in Editor" button opens draggable/resizable 900×700 overlay | 🔲 | `CodeEditorPanel.tsx`; z-index layer above issue panels |
| 25.13 | Issue detail split view — side-by-side layout: issue details (left 40%) + code-server iframe (right 60%); toggle button in issue header | 🔲 | Responsive breakpoint: collapses to tabs on screens < 1400px |

### 25e. Stretch Goals

| # | Task | Status | Notes |
|---|------|--------|-------|
| 25.14 | Pre-install common extensions — ESLint, Prettier, GitLens, Paperclip Issue Context — baked into the Docker image at build time | 🔲 | `code-server --install-extension` in Dockerfile; user can add more via UI |
| 25.15 | Collaborative editing — enable VS Code Live Share or equivalent when two users have the same issue open in editor simultaneously | 🔲 | Requires `@vscode/live-share` or Firepad integration; complex, low priority |
| 25.16 | Mobile-friendly terminal fallback — when viewport too narrow for full editor, show `xterm.js` terminal-only view connected to a shell in the agent workspace container | 🔲 | `ui/src/components/AgentTerminal.tsx`; uses `xterm.js` + WebSocket shell proxy |

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
