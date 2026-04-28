# Telegram & WhatsApp Business Integration Plan

**Date:** 2026-04-27  
**Status:** Proposal / Foundation Layer 3 Extension  
**Owner:** OpenCode Agent

---

## 1. Goal

Enable Paperclip companies to receive real-time business notifications and interact with their AI workforce via **Telegram** and **WhatsApp Business API**. Messages are configurable per-company, and the bot supports **two-way interaction** (user replies trigger Paperclip actions).

**Key feature:** Dashboard stats are rendered as **PNG images** and sent alongside text summaries.

---

## 2. Supported Message Types (Company-Configurable)

Each company can toggle which message types they want to receive.

| Message Type | Trigger | Image Attachment |
|--------------|---------|------------------|
| **New Issue Created** | Issue is opened (not backlog) | Optional: project burndown chart |
| **Issue Blocked** | Issue status changes to `blocked` | Yes: blocked issues dashboard |
| **Issue Completed** | Issue status changes to `done` | Yes: sprint completion stats |
| **Run Hang Alert** | Heartbeat run stuck > 15 min | Yes: agent performance dashboard |
| **Daily Digest** | Cron at 09:00 company timezone | Yes: full company dashboard |
| **Weekly Report** | Every Monday 09:00 | Yes: KPI trend image |

---

## 3. Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Paperclip      │     │  Messaging       │     │  Telegram /     │
│  Server         │────▶│  Router Service  │────▶│  WhatsApp       │
│  (Events)       │     │  (server/src/)   │     │  (External APIs)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
         ▲                                              │
         │    User replies (webhooks)                   │
         └──────────────────────────────────────────────┘
```

### 3.1 New Database Tables

```sql
-- messaging_providers
CREATE TABLE messaging_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('telegram','whatsapp')),
  enabled boolean NOT NULL DEFAULT false,
  config jsonb NOT NULL DEFAULT '{}',
  -- Telegram: { botToken, chatId }
  -- WhatsApp: { phoneNumberId, accessToken, templateNamespace }
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider)
);

-- messaging_subscriptions (per-type toggle)
CREATE TABLE messaging_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('telegram','whatsapp')),
  message_type text NOT NULL CHECK (message_type IN (
    'new_issue','issue_blocked','issue_completed',
    'run_hang','daily_digest','weekly_report'
  )),
  enabled boolean NOT NULL DEFAULT false,
  include_image boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(company_id, provider, message_type)
);

-- messaging_deliveries (audit + idempotency)
CREATE TABLE messaging_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  provider text NOT NULL,
  message_type text NOT NULL,
  payload_hash text NOT NULL, -- sha256 of rendered payload for dedupe
  external_message_id text,   -- Telegram message_id or WhatsApp wamid
  status text NOT NULL CHECK (status IN ('pending','sent','delivered','failed')),
  error text,
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
```

### 3.2 Image Generation Pipeline

Dashboard stats are rendered as images using **Playwright** (headless Chromium) or **Satori** (SVG-to-PNG):

```
Event Trigger
    │
    ▼
┌─────────────────────┐
│ Stats Composer      │  ← Aggregates data from DB (issue counts, agent KPIs, budget)
│ (server/src/services│
│  /messaging/stats.ts)│
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Image Renderer      │  ← Reacts to a hidden /internal/dashboard-image route
│ (Playwright/Satori) │    that returns a 1200×630 PNG
└─────────────────────┘
    │
    ▼
┌─────────────────────┐
│ Message Builder     │  ← Combines text + image into Telegram/WhatsApp payload
│ (server/src/services│
│  /messaging/build.ts)│
└─────────────────────┘
```

**Image types:**
- `sprint-burndown.png` – Issues todo→done over time
- `agent-performance.png` – Runs, completion rate, cost per agent
- `blocked-issues.png` – List of blocked issues with assignees
- `company-overview.png` – Full dashboard summary

---

## 4. Telegram Integration Details

### 4.1 Setup Flow (UI)

1. Company admin goes to **Settings → Integrations → Telegram**
2. Clicks "Connect Telegram Bot"
3. UI shows instructions:
   - Open `@BotFather` in Telegram
   - Create a new bot (`/newbot`)
   - Paste the **bot token** into Paperclip
   - Send `/start` to the bot from the company's group chat
   - Bot replies with the **chat ID**
   - Paste chat ID into Paperclip
4. Paperclip calls `getChat` to verify the token + chat ID
5. Toggle message types on/off

### 4.2 Outgoing Messages

Uses Telegram Bot API `sendPhoto` (for images) or `sendMessage` (text only):

```typescript
// sendPhoto multipart/form-data
const form = new FormData();
form.append("chat_id", chatId);
form.append("photo", new Blob([pngBuffer], { type: "image/png" }), "dashboard.png");
form.append("caption", textSummary);
form.append("parse_mode", "MarkdownV2");
form.append("reply_markup", JSON.stringify({
  inline_keyboard: [[
    { text: "View in Paperclip", url: `${paperclipBaseUrl}/issues/${issueId}` }
  ]]
}));
```

### 4.3 Incoming Replies (Two-Way)

Webhook endpoint: `POST /api/webhooks/telegram/:companyId`

Supported commands:
- `/status` – Show company overview image + active agents
- `/issues` – List open issues
- `/block` – List blocked issues
- `/done` – List recently completed issues
- `/wake <agent-name>` – Trigger on-demand wakeup for an agent
- `/pause <agent-name>` – Pause an agent
- Reply to an issue notification with text → Adds a comment to that issue

---

## 5. WhatsApp Business API Integration Details

### 5.1 Setup Flow (UI)

1. Company admin goes to **Settings → Integrations → WhatsApp**
2. Clicks "Connect WhatsApp"
3. UI shows Meta Developer Portal instructions:
   - Create a Meta App with WhatsApp product
   - Link a WhatsApp Business Account (WABA)
   - Copy **Phone Number ID** and **Access Token**
   - Paste into Paperclip
   - Enter the admin's WhatsApp number for verification
4. Paperclip sends a test template message to verify credentials
5. Toggle message types on/off

### 5.2 Message Templates (Required by Meta)

WhatsApp requires **pre-approved message templates** for outbound notifications. Paperclip provides a default template namespace:

```
paperclip_new_issue   – "New issue {{1}} opened in {{2}}: {{3}}"
paperclip_blocked     – "Issue {{1}} is blocked: {{2}}"
paperclip_completed   – "Issue {{1}} completed by {{2}}"
paperclip_run_hang    – "Agent {{1}} run hang detected after {{2}} min"
paperclip_digest      – "Daily digest: {{1}} open, {{2}} done, {{3}} blocked"
```

**Images:** WhatsApp supports `image` media type in template messages. The PNG is uploaded to Meta's media server first, then referenced by `media_id`.

### 5.3 Incoming Replies

Webhook endpoint: `POST /api/webhooks/whatsapp/:companyId`

Uses WhatsApp Interactive Messages for commands:
- Button reply "Status" → sends dashboard image
- Button reply "Issues" → lists open issues
- Free-text reply to a notification → adds comment

---

## 6. UI Settings Page

New page: `/settings/integrations/messaging`

```
┌─────────────────────────────────────────────┐
│  Messaging Integrations                     │
├─────────────────────────────────────────────┤
│  Telegram                                   │
│  [Toggle] Enabled                           │
│  Bot Token: [••••••••] [Verify]            │
│  Chat ID:   [-1001234567890]               │
│                                             │
│  Notifications:                             │
│  [✓] New Issues        [✓] Include image   │
│  [✓] Blocked Issues    [✓] Include image   │
│  [✓] Completed Issues  [✓] Include image   │
│  [✓] Run Hang Alerts   [✓] Include image   │
│  [ ] Daily Digest      [✓] Include image   │
│  [ ] Weekly Report     [✓] Include image   │
├─────────────────────────────────────────────┤
│  WhatsApp                                   │
│  [Toggle] Enabled                           │
│  Phone Number ID: [123456789012345]        │
│  Access Token:    [••••••••] [Verify]      │
│  ... (same notification toggles)            │
└─────────────────────────────────────────────┘
```

---

## 7. Implementation Phases

### Phase 1 – Foundation (Week 1)
- [ ] DB schema: `messaging_providers`, `messaging_subscriptions`, `messaging_deliveries`
- [ ] Shared types & validators
- [ ] Telegram Bot API client (`server/src/services/messaging/telegram.ts`)
- [ ] Basic outgoing message service (`server/src/services/messaging/outgoing.ts`)
- [ ] Settings UI page skeleton

### Phase 2 – Notifications (Week 2)
- [ ] Hook into issue lifecycle events (create, block, complete)
- [ ] Hook into heartbeat run status changes (hang detection)
- [ ] Implement `StatsComposer` for text summaries
- [ ] Wire Telegram outbound for all 6 message types
- [ ] Subscriptions UI (toggles per type)

### Phase 3 – Images (Week 3)
- [ ] Hidden `/internal/dashboard-image` route (PNG renderer)
  - Use Satori + @resvg/resvg-js for server-side SVG→PNG
  - Or Playwright if complex charts needed
- [ ] Dashboard stat components (sprint burndown, agent performance, etc.)
- [ ] Attach images to Telegram `sendPhoto`
- [ ] Meta media upload for WhatsApp image templates

### Phase 4 – WhatsApp + Two-Way (Week 4)
- [ ] WhatsApp Business API client
- [ ] Message template registration helpers
- [ ] Webhook handlers for Telegram & WhatsApp incoming messages
- [ ] Command parser (`/status`, `/issues`, `/wake`, etc.)
- [ ] Reply-to-comment mapping (track `external_message_id` → issue mapping)

### Phase 5 – Polish (Week 5)
- [ ] Rate limiting & retry logic for API clients
- [ ] Idempotency (payload_hash dedupe)
- [ ] Delivery status tracking UI
- [ ] Documentation & onboarding flow

---

## 8. Files to Create / Modify

### New Files
```
packages/db/src/schema/messaging.ts          ← 3 new tables
packages/shared/src/types/messaging.ts       ← provider configs, message types
packages/shared/src/validators/messaging.ts  ← zod schemas

server/src/services/messaging/
  ├── index.ts
  ├── outgoing.ts          ← main dispatch logic
  ├── telegram.ts          ← Telegram Bot API client
  ├── whatsapp.ts          ← WhatsApp Business API client
  ├── stats.ts             ← StatsComposer (aggregates)
  ├── image-renderer.ts    ← SVG→PNG renderer
  ├── commands.ts          ← User command parser
  └── webhooks.ts          ← Incoming webhook handlers

server/src/routes/
  ├── messaging-routes.ts       ← CRUD providers/subscriptions
  ├── messaging-webhook-routes.ts ← Telegram/WhatsApp webhooks
  └── dashboard-image-route.ts  ← Internal PNG renderer

ui/src/pages/settings/
  └── MessagingIntegrations.tsx
```

### Modified Files
```
server/src/services/heartbeat.ts            ← emit events for run hangs
server/src/services/issues.ts               ← emit events for status changes
server/src/index.ts                         ← register new routes
packages/db/src/schema/index.ts             ← export messaging tables
```

---

## 9. Security & Compliance

- **Bot tokens & access tokens** stored encrypted (AES-256) in `messaging_providers.config`
- **Webhook verification:** Telegram uses secret token in header; WhatsApp validates signature with app secret
- **Rate limiting:** Max 10 messages/minute per company per provider
- **Opt-in only:** No messages sent until company explicitly enables and verifies provider
- **GDPR:** All message content is ephemeral; only delivery metadata is stored > 30 days

---

## 10. Success Metrics

- % of companies enabling at least one messaging integration
- Avg response time to blocked issue alerts (target: < 5 min)
- Reduction in "stuck run" resolution time (target: -50%)
- User engagement: commands sent per week per active integration
