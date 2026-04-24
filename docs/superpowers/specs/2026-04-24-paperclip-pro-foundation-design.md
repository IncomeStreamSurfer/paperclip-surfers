# Paperclip Pro+ Foundation Design

Date: 2026-04-24
Branch: to be created from master
Sub-project: Foundation (Phase 1 of Paperclip Pro+)

## Context

Paperclip Pro+ transforms Paperclip from a single-operator control plane into a full AI business platform. Foundation is the first and load-bearing sub-project — it adds multi-user support, roles, departments, a credentials vault, white-labeling, and email. Every other Pro+ module depends on this layer.

## Scope

Foundation is delivered in four independent layers. Each layer is a complete spec → plan → implementation cycle. Later layers depend on earlier ones but earlier layers ship and are usable on their own.

| Layer | Content |
|-------|---------|
| 1 | Multi-user auth + roles + invitations |
| 2 | Departments + asset scoping |
| 3 | Credentials vault + agent request/approval |
| 4 | White-labeling + email (all four use cases) |

## Out of Scope

- Industry modules (Social Media, SEO, Call Center, etc.) — separate sub-projects
- Dashboard widgets and avatars — separate sub-project
- Multi-LLM support — separate sub-project
- Knowledge base / MemPalace / vector DB — separate sub-project

---

## Architecture

### Core Principles

- Better Auth stays as the auth engine. Extended with invitations and role tables, not replaced.
- All existing routes gain role-check middleware. Current board-operator behavior maps to Company Admin — no breaking change.
- Credentials encrypted at rest with AES-256-GCM. Key from `VAULT_ENCRYPTION_KEY` env var with key-version support for rotation. Plaintext never persists.
- All four email use cases route through a single `EmailService` that resolves SMTP config (company override → deployment default) and renders Handlebars templates.
- White-label assets (logos, templates, letterhead) stored as files in the `paperclip-data` volume, referenced by path in the DB.
- Department scoping is additive — existing tables gain a nullable `departmentId` column. Null means company-wide.

### New Tables

| Layer | Tables |
|-------|--------|
| 1 | `user_company_roles`, `user_invitations` |
| 2 | `departments`, `agent_departments` |
| 3 | `credentials`, `credential_department_access`, `credential_agent_access`, `credential_requests` |
| 4 | `deployment_smtp`, `company_branding`, `email_templates` |

---

## Layer 1 — Multi-user Auth + Roles

### User Model

Better Auth manages the `user` table (sessions, passwords). We add:

```
user_company_roles
  userId         uuid  FK → better_auth.user
  companyId      uuid  FK → companies
  role           text  enum: super_admin | company_admin | manager | viewer
  createdAt      timestamptz
```

`super_admin` is deployment-wide (not company-scoped). The first registered user becomes Super Admin, or the user whose email matches `PAPERCLIP_SUPER_ADMIN_EMAIL` env var if set.

**Role capabilities:**

| Role | Scope | Can do |
|------|-------|--------|
| super_admin | Deployment | Manage all companies, all users, deployment settings, billing |
| company_admin | Company | Full control — agents, projects, budgets, members, branding |
| manager | Company | Manage tasks, projects, agents; no billing/budget access |
| viewer | Company | Read-only |

### Invitations

```
user_invitations
  id             uuid  PK
  email          text  not null
  companyId      uuid  FK → companies (nullable for super_admin invites)
  role           text  enum: super_admin | company_admin | manager | viewer
  token          uuid  not null unique
  invitedByUserId uuid FK → better_auth.user
  expiresAt      timestamptz  (72 hours from creation)
  acceptedAt     timestamptz  nullable
  createdAt      timestamptz
```

Flow:
1. Admin enters email + role in Settings → Team Members → Invite
2. `user_invitations` row created, token emailed via EmailService using `invite` template
3. Recipient clicks link → `/accept-invite/:token` → sets password → auto-login → dashboard
4. `user_company_roles` row created, `acceptedAt` stamped on invitation

### Role Enforcement

`requireRole(minRole)` middleware added to all existing routes. Role hierarchy: `viewer < manager < company_admin < super_admin`. Existing `assertCompanyAccess` maps transparently to `company_admin` check — no existing behavior changes.

### UI Additions

- **Settings → Team Members**: list users with roles, invite by email, change role, revoke access
- **`/accept-invite/:token`**: accept invitation page — set password, auto-login
- **Login page**: email + password form (Better Auth already handles sessions)

---

## Layer 2 — Departments

### Schema

```
departments
  id             uuid  PK
  companyId      uuid  FK → companies
  name           text  not null
  description    text  nullable
  color          text  nullable (hex color for org chart grouping box)
  leadUserId     uuid  nullable FK → better_auth.user
  createdAt      timestamptz
  updatedAt      timestamptz

agent_departments
  agentId        uuid  FK → agents (cascade delete)
  departmentId   uuid  FK → departments (cascade delete)
  PRIMARY KEY (agentId, departmentId)
```

### Asset Scoping

All existing asset tables (memories, routines, skills, budgets, credentials) gain:

```
departmentId   uuid  nullable FK → departments
sharedWith     jsonb  array of department UUIDs (default [])
```

**Visibility rules:**

| departmentId | sharedWith | Visible to |
|---|---|---|
| null | [] | All departments (company-wide) |
| null | [X, Y] | Only departments X and Y |
| X | [] | Only department X |

Department budgets are separate budget records with `departmentId` set. Department spend rolls up into company total.

### Org Chart

Departments render as labeled grouping boxes (using `color`) behind their member agents. Clicking a department opens a side panel: member agents, lead user, links to department-scoped memories/rules/skills/credentials.

### UI Additions

- **Org chart**: department grouping boxes rendered behind agents
- **Settings → Departments**: create/rename/delete departments, assign agents, assign lead user, view scoped assets
- **Asset forms** (memories, routines, etc.): department scope selector added

---

## Layer 3 — Credentials Vault

### Schema

```
credentials
  id                   uuid  PK
  companyId            uuid  FK → companies
  departmentId         uuid  nullable FK → departments
  name                 text  not null
  description          text  nullable
  encryptedValue       text  not null  (AES-256-GCM, base64)
  iv                   text  not null  (random per credential, base64)
  encryptionKeyVersion int   not null  default 1
  createdByUserId      uuid  FK → better_auth.user
  createdAt            timestamptz
  updatedAt            timestamptz

credential_department_access
  credentialId   uuid  FK → credentials (cascade delete)
  departmentId   uuid  FK → departments (cascade delete)
  PRIMARY KEY (credentialId, departmentId)

credential_agent_access
  credentialId   uuid  FK → credentials (cascade delete)
  agentId        uuid  FK → agents (cascade delete)
  PRIMARY KEY (credentialId, agentId)

credential_requests
  id                   uuid  PK
  companyId            uuid  FK → companies
  agentId              uuid  FK → agents
  credentialName       text  not null
  reason               text  not null  (required — agent must justify the request)
  status               text  enum: pending | approved | rejected
  adminResponse        text  nullable  (admin note on approval or rejection reason)
  resolvedByUserId     uuid  nullable FK → better_auth.user
  resolvedCredentialId uuid  nullable FK → credentials
  createdAt            timestamptz
  resolvedAt           timestamptz nullable
```

### Encryption

AES-256-GCM. Random IV per credential. Key derived from `VAULT_ENCRYPTION_KEY` env var + `encryptionKeyVersion` (enables key rotation without re-encrypting all values at once). Plaintext never stored, logged, or returned by list endpoints.

### Access Control

An agent can read a credential if:
- It appears in `credential_agent_access`, OR
- It belongs to a department the agent is in (`credential_department_access` + `agent_departments`), OR
- It is company-wide (`departmentId = null`, no access rows)

### Agent API

```
GET  /api/agent/credentials/:name        → decrypted value (403 if no access)
POST /api/agent/credential-requests      → { name, reason } — submits a request
GET  /api/agent/credential-requests/:id  → check request status + adminResponse
```

### Credential Request Flow

1. Agent calls `POST /api/agent/credential-requests` with `{ name, reason }` (reason required)
2. `credential_requests` row created with `status: pending`
3. Alert email sent to all Company Admins — includes agent name, requested credential name, and full justification text
4. Admin reviews in Settings → Credentials Vault → Pending Requests
5. Admin approves (creates credential + grants access, optionally adds admin note) or rejects (adds rejection reason)
6. Agent polls `GET /api/agent/credential-requests/:id` to check status; on approval, fetches credential by name

### UI Additions

- **Settings → Credentials Vault**: list credentials (names + scopes; values never displayed), create/edit/delete, manage department and agent access
- **Pending Requests tab**: shows agent name, credential name, full justification, approve/reject with admin response field

---

## Layer 4 — White-labeling + Email

### Schema

```
deployment_smtp
  id                uuid  PK
  host              text  not null
  port              int   not null  default 587
  secure            bool  not null  default false
  username          text  not null
  encryptedPassword text  not null  (AES-256-GCM, same key as vault)
  iv                text  not null
  fromName          text  not null
  fromEmail         text  not null
  updatedAt         timestamptz

company_branding
  id             uuid  PK
  companyId      uuid  FK → companies unique
  productName    text  nullable  (replaces "Paperclip" in UI)
  logoPath       text  nullable  (path in paperclip-data volume)
  faviconPath    text  nullable
  iconSet        text  nullable
  primaryColor   text  nullable  (hex)
  accentColor    text  nullable  (hex)
  backgroundColor text nullable  (hex)
  customDomain   text  nullable
  smtpOverrideId uuid  nullable FK → deployment_smtp
  letterheadPath text  nullable  (HTML file path in volume)
  updatedAt      timestamptz

email_templates
  id              uuid  PK
  companyId       uuid  nullable FK → companies  (null = deployment default)
  templateKey     text  not null  (invite | alert_budget | alert_approval | alert_credential_request | alert_agent_paused | agent_email | bulk)
  subjectTemplate text  not null  (Handlebars)
  htmlTemplate    text  not null  (Handlebars — includes {{companyLogo}}, {{companyName}}, etc.)
  textTemplate    text  not null  (plain text fallback)
  updatedAt       timestamptz
  UNIQUE (companyId, templateKey)
```

### EmailService

Single service used by all email use cases:

1. Resolve SMTP: company `smtpOverrideId` → deployment `deployment_smtp` → error if neither configured
2. Load template: by `(companyId, templateKey)` → fallback to `(null, templateKey)` deployment default
3. Render: Handlebars with variables (`{{agentName}}`, `{{companyLogo}}`, `{{companyName}}`, `{{reason}}`, etc.)
4. All HTML emails include company logo header + branded footer from `company_branding`
5. Send via Nodemailer (SMTP) for use cases A/B/C; Mailgun/SendGrid SDK for use case D (bulk)

### Email Use Cases

| Key | Trigger | Recipient |
|-----|---------|-----------|
| `invite` | Admin invites a user | Invited user |
| `agent_email` | Agent calls `POST /api/agent/send-email` | External address specified by agent |
| `alert_budget` | Budget hard-stop triggered | All Company Admins |
| `alert_approval` | Approval gate hit | Approvers |
| `alert_credential_request` | Agent submits credential request (includes full justification) | All Company Admins |
| `alert_agent_paused` | Agent auto-paused | All Company Admins |
| `bulk` | Agent or admin triggers campaign | Recipient list (Mailgun/SendGrid) |

### Document Letterhead

`letterheadPath` in `company_branding` points to an HTML file. Document generator services render content into this template. Variables: `{{companyLogo}}`, `{{companyName}}`, `{{date}}`, `{{content}}`. Stored in the `paperclip-data` volume.

### UI Additions

- **Settings → Branding**: upload logo/favicon, color pickers, product name, custom domain, icon set, letterhead HTML editor with preview
- **Settings → Email**: deployment SMTP config, per-company SMTP override, email template editor with live preview
