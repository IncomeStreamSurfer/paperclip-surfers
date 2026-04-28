# Foundation Layer 3 — Model Management + AI Suggestions

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Pro+ admin controls for managing which AI models are available to company users, plus an AI-powered model suggestion system that helps users choose the best model for their use case.

**Architecture:** New `company_allowed_models` DB table stores model enable/disable state per company. The suggestions API filters based on admin settings. New UI components show "Use" and "Install" buttons for Ollama models.

**Tech Stack:** Drizzle ORM + PGlite, Express 5, React 19 + TanStack Query, Tailwind 4, TypeScript strict

---

## Scope

### Pro+ Model Management

- **Admins (company_admin):** Can enable/disable specific models for their company users
- **Pro+ restrictions:** Only allowed models appear in dropdowns; suggestions filtered to allowed set
- **Free tier:** No restrictions — all discovered models available

### AI Model Suggestions

- Ranked suggestions based on use case (code, reasoning, fast, general)
- **Ollama models:** Show "Install" button for available (not installed) models; "Use" for installed
- **Cloud models:** Show "Use" button (auto-enables if not already allowed for Pro+)

---

## File Map

**Created:**
- `packages/db/src/schema/company_allowed_models.ts` — model allowlist table
- `packages/shared/src/validators/models.ts` — Zod schemas for model management
- `server/src/routes/models.ts` — REST routes for model management + suggestions
- `server/src/services/model-discovery.ts` — enhanced with available models + install
- `ui/src/api/models.ts` — UI API client
- `ui/src/pages/ModelSettings.tsx` — Admin page to manage allowed models

**Modified:**
- `packages/db/src/schema/index.ts` — export new table
- `packages/shared/src/constants.ts` — add MODEL_PROVIDERS constant
- `server/src/routes/agents.ts` — add /models/* endpoints
- `ui/src/components/AgentConfigForm.tsx` — add AI Suggestions button

---

## Database Schema

### company_allowed_models

```typescript
// packages/db/src/schema/company_allowed_models.ts
export const companyAllowedModels = pgTable(
  "company_allowed_models",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    modelId: text("model_id").notNull(), // e.g., "ollama/llama3", "openai/gpt-4o"
    provider: text("provider").notNull(), // "ollama", "openai", "openrouter", "anthropic", "google"
    enabled: boolean("enabled").notNull().default(true),
    allowedAt: timestamp("allowed_at").notNull().defaultNow(),
    allowedByUserId: uuid("allowed_by_user_id").references(() => users.id),
  },
  (table) => [
    { unique: [table.companyId, table.modelId] },
    index("company_allowed_models_company_id_idx").on(table.companyId),
  ],
);
```

---

## API Routes

### Model Management (Pro+ Admin)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /companies/:companyId/models/allowed | company_admin | List allowed models for company |
| PUT | /companies/:companyId/models/allowed | company_admin | Bulk update allowed models |
| PATCH | /companies/:companyId/models/allowed/:modelId | company_admin | Enable/disable single model |

### Model Suggestions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /models/suggestions | - | Get ranked model suggestions (filtered by allowed for Pro+) |
| GET | /models/available | - | Get Ollama models available to install |
| POST | /models/install | - | Pull Ollama model to server |

---

## Implementation Steps

- [ ] **Task 1:** Create DB schema `company_allowed_models`
- [ ] **Task 2:** Add validators for model management in shared
- [ ] **Task 3:** Enhance model-discovery service with `getAvailableOllamaModels` + `installOllamaModel`
- [ ] **Task 4:** Add route for model management (allow list CRUD)
- [ ] **Task 5:** Update suggestions API to filter by allowed models for Pro+ companies
- [ ] **Task 6:** Add UI API client for models
- [ ] **Task 7:** Create ModelSettings admin page
- [ ] **Task 8:** Add "Get AI Suggestions" button to AgentConfigForm
- [ ] **Task 9:** Generate migration + typecheck

---

## Key Behaviors

1. **Free tier:** No model restrictions; all discovered models available
2. **Pro+ tier:** Only models where `enabled=true` in `company_allowed_models` shown
3. **Default for Pro+:** When first enabled, pre-populate with top 10 ranked models
4. **Ollama install:** Admin or users can install new Ollama models; auto-added to allowed list
5. **Suggestions filtered:** For Pro+, suggestions only include models in the allowed set

---

## Subscription Tier Detection

The server must detect if a company is on Pro+ or Free tier. This requires either:
- A `pricing_tier` column on `companies` table, OR
- External billing integration

For now, assume: companies WITH `company_allowed_models` rows = Pro+; companies without = Free.

---

## Acceptance Criteria

1. Admin can view list of allowed/enabled models per company
2. Admin can enable/disable specific models
3. For Pro+ companies, model dropdown only shows enabled models
4. For Pro+ companies, suggestions only include enabled models
5. "Get AI Suggestions" shows installed models with "Use" button
6. "Get AI Suggestions" shows available Ollama models with "Install" button
7. Install button triggers Ollama model pull
8. Typecheck + migration generation passes

---

## Additional Pro+ Features

### Agent Avatars

- Add agent avatar display to the right of the agent name in the agent list/chart
- Avatar should appear if an avatar URL has been generated for the agent
- Avatar displayed as small circular image next to agent name

### Blocked Issue Email Notification

- When an agent marks an issue as blocked, they can send an email to the board
- Email should include: agent name, issue details, block reason, timestamp
- Board receives notification and can take action to unblock

### Admin Dashboard (Usage & Billing)

- Central admin panel for monitoring all AI model usage
- View usage statistics per model, per agent, per company
- Track expenses by model provider (OpenAI, Anthropic, Ollama, etc.)
- Subscription management: view plan status, upgrade/downgrade options
- API key usage tracking and limits per provider
- Ability for admin to manage all models and providers from one place
- Real-time cost dashboards with charts

---

## Deployment

For every new implementation batch, build Docker image and restart the container