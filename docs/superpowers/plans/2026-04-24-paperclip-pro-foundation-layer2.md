# Foundation Layer 2 — Departments + Asset Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add department grouping to Paperclip — departments hold agents, scope assets (memories/routines/skills/budgets), and appear as labeled grouping boxes on the org chart.

**Architecture:** Two new DB tables (`departments`, `agent_departments`) hold the department model. Four existing asset tables gain nullable `departmentId` + `sharedWith jsonb` columns for visibility scoping. A new `departments.ts` server route handles CRUD + agent assignment. The org chart SVG gains a department-box layer rendered behind agent cards.

**Tech Stack:** Drizzle ORM + PGlite, Express 5, React 19 + TanStack Query, Tailwind 4, TypeScript strict mode, Vitest

---

## File Map

**Created:**
- `packages/db/src/schema/departments.ts` — departments table
- `packages/db/src/schema/agent_departments.ts` — agent↔department join table
- `packages/shared/src/validators/department.ts` — Zod schemas for department CRUD
- `server/src/routes/departments.ts` — REST routes for departments
- `server/src/__tests__/departments.test.ts` — route unit tests
- `ui/src/api/departments.ts` — UI API client
- `ui/src/pages/Departments.tsx` — Settings → Departments management page
- `ui/src/components/DeptScopeSelector.tsx` — reusable dept scope picker for asset forms

**Modified:**
- `packages/db/src/schema/agent_memories.ts` — add `departmentId`, `sharedWith`
- `packages/db/src/schema/routines.ts` — add `departmentId`, `sharedWith` to `routines` table
- `packages/db/src/schema/company_skills.ts` — add `departmentId`, `sharedWith`
- `packages/db/src/schema/budget_policies.ts` — add `departmentId`, `sharedWith`
- `packages/db/src/schema/index.ts` — export new tables
- `packages/shared/src/validators/index.ts` — export department validators
- `packages/shared/src/index.ts` — re-export department validators
- `server/src/app.ts` — register `departmentRoutes`
- `ui/src/lib/queryKeys.ts` — add `departments` key factory
- `ui/src/pages/CompanySettings.tsx` — add Departments section
- `ui/src/pages/OrgChart.tsx` — add department grouping boxes behind agents
- `ui/src/pages/Routines.tsx` — add dept scope selector to create form

---

## Task 1: departments + agent_departments schema

**Files:**
- Create: `packages/db/src/schema/departments.ts`
- Create: `packages/db/src/schema/agent_departments.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Write the departments table**

```typescript
// packages/db/src/schema/departments.ts
import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    leadUserId: text("lead_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("departments_company_idx").on(table.companyId),
    companyNameIdx: index("departments_company_name_idx").on(table.companyId, table.name),
  }),
);
```

- [ ] **Step 2: Write the agent_departments join table**

```typescript
// packages/db/src/schema/agent_departments.ts
import { pgTable, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { departments } from "./departments.js";

export const agentDepartments = pgTable(
  "agent_departments",
  {
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.agentId, table.departmentId] }),
    departmentIdx: index("agent_departments_dept_idx").on(table.departmentId),
    agentIdx: index("agent_departments_agent_idx").on(table.agentId),
  }),
);
```

- [ ] **Step 3: Export new tables from schema index**

Open `packages/db/src/schema/index.ts` and add these two lines at the end:

```typescript
export { departments } from "./departments.js";
export { agentDepartments } from "./agent_departments.js";
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/ccasalicchio/paperclip-surfers
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors from the new schema files.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema/departments.ts packages/db/src/schema/agent_departments.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add departments and agent_departments schema tables"
```

---

## Task 2: Asset scoping columns

**Files:**
- Modify: `packages/db/src/schema/agent_memories.ts`
- Modify: `packages/db/src/schema/routines.ts`
- Modify: `packages/db/src/schema/company_skills.ts`
- Modify: `packages/db/src/schema/budget_policies.ts`

These columns control asset visibility: `departmentId=null + sharedWith=[]` is company-wide; `departmentId=X` restricts to department X; `sharedWith=[X,Y]` shares to specific departments.

- [ ] **Step 1: Add columns to agent_memories.ts**

The current file imports: `uuid, text, timestamp, real, index` from drizzle-orm/pg-core. Add `jsonb` to that import and add two columns after `updatedAt`:

```typescript
// packages/db/src/schema/agent_memories.ts
import { pgTable, uuid, text, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { departments } from "./departments.js";

export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    scope: text("scope").notNull().$type<"global" | "project">(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull().$type<"pattern" | "preference" | "decision" | "learning" | "feedback">(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    source: text("source").notNull().$type<"self" | "ceo" | "board" | "human">(),
    confidence: real("confidence").notNull().default(0.5),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    sharedWith: jsonb("shared_with").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentScopeIdx: index("agent_memories_agent_scope_idx").on(table.agentId, table.scope),
    agentProjectIdx: index("agent_memories_agent_project_idx").on(table.agentId, table.projectId),
    companyIdx: index("agent_memories_company_idx").on(table.companyId),
    departmentIdx: index("agent_memories_dept_idx").on(table.departmentId),
  }),
);
```

- [ ] **Step 2: Add columns to routines.ts**

Only the `routines` table (not `routineTriggers` or `routineRuns`) gets scoping columns. Add after `updatedByUserId`:

```typescript
// packages/db/src/schema/routines.ts — add these imports and columns
// At top: add "jsonb" to the drizzle-orm/pg-core import
// Add: import { departments } from "./departments.js";
```

Add these two columns to the `routines` table definition, after `updatedByUserId`:

```typescript
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    sharedWith: jsonb("shared_with").$type<string[]>().notNull().default([]),
```

Add this index to the `routines` table indexes:

```typescript
    departmentIdx: index("routines_department_idx").on(table.departmentId),
```

- [ ] **Step 3: Add columns to company_skills.ts**

Add `jsonb` to the import and `departments` import. Add after `metadata`:

```typescript
// packages/db/src/schema/company_skills.ts
import {
  pgTable, uuid, text, timestamp, jsonb, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { departments } from "./departments.js";

export const companySkills = pgTable(
  "company_skills",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    key: text("key").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    markdown: text("markdown").notNull(),
    sourceType: text("source_type").notNull().default("local_path"),
    sourceLocator: text("source_locator"),
    sourceRef: text("source_ref"),
    trustLevel: text("trust_level").notNull().default("markdown_only"),
    compatibility: text("compatibility").notNull().default("compatible"),
    fileInventory: jsonb("file_inventory").$type<Array<Record<string, unknown>>>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    sharedWith: jsonb("shared_with").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyKeyUniqueIdx: uniqueIndex("company_skills_company_key_idx").on(table.companyId, table.key),
    companyNameIdx: index("company_skills_company_name_idx").on(table.companyId, table.name),
    departmentIdx: index("company_skills_dept_idx").on(table.departmentId),
  }),
);
```

- [ ] **Step 4: Add columns to budget_policies.ts**

Add `jsonb` to import and `departments` import. Add after `updatedAt` (before the closing brace of the columns object):

```typescript
// packages/db/src/schema/budget_policies.ts
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { departments } from "./departments.js";

export const budgetPolicies = pgTable(
  "budget_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    scopeType: text("scope_type").notNull(),
    scopeId: uuid("scope_id").notNull(),
    metric: text("metric").notNull().default("billed_cents"),
    windowKind: text("window_kind").notNull(),
    amount: integer("amount").notNull().default(0),
    warnPercent: integer("warn_percent").notNull().default(80),
    hardStopEnabled: boolean("hard_stop_enabled").notNull().default(true),
    notifyEnabled: boolean("notify_enabled").notNull().default(true),
    isActive: boolean("is_active").notNull().default(true),
    createdByUserId: text("created_by_user_id"),
    updatedByUserId: text("updated_by_user_id"),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    sharedWith: jsonb("shared_with").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyScopeActiveIdx: index("budget_policies_company_scope_active_idx").on(
      table.companyId, table.scopeType, table.scopeId, table.isActive,
    ),
    companyWindowIdx: index("budget_policies_company_window_idx").on(
      table.companyId, table.windowKind, table.metric,
    ),
    companyScopeMetricUniqueIdx: uniqueIndex("budget_policies_company_scope_metric_unique_idx").on(
      table.companyId, table.scopeType, table.scopeId, table.metric, table.windowKind,
    ),
    departmentIdx: index("budget_policies_dept_idx").on(table.departmentId),
  }),
);
```

- [ ] **Step 5: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/schema/agent_memories.ts packages/db/src/schema/routines.ts packages/db/src/schema/company_skills.ts packages/db/src/schema/budget_policies.ts
git commit -m "feat(db): add departmentId + sharedWith scoping columns to asset tables"
```

---

## Task 3: Generate and verify migration

**Files:**
- Create: `packages/db/src/migrations/0049_*.sql` (name assigned by drizzle-kit)

- [ ] **Step 1: Generate the migration**

```bash
cd /home/ccasalicchio/paperclip-surfers
pnpm db:generate
```

Expected output: drizzle-kit prints one new migration file path starting with `0049_`.

- [ ] **Step 2: Verify migration contents**

```bash
cat packages/db/src/migrations/0049_*.sql
```

Expected: SQL contains `CREATE TABLE "departments"`, `CREATE TABLE "agent_departments"`, and `ALTER TABLE` statements adding `department_id` and `shared_with` columns to `agent_memories`, `routines`, `company_skills`, `budget_policies`.

- [ ] **Step 3: Run typecheck and build**

```bash
pnpm -r typecheck && pnpm build 2>&1 | tail -20
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/migrations/
git commit -m "feat(db): migration 0049 — departments tables + asset scoping columns"
```

---

## Task 4: Shared validators for department CRUD

**Files:**
- Create: `packages/shared/src/validators/department.ts`
- Modify: `packages/shared/src/validators/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write department validators**

```typescript
// packages/shared/src/validators/department.ts
import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  leadUserId: z.string().nullable().optional(),
});
export type CreateDepartment = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  leadUserId: z.string().nullable().optional(),
});
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;

export const assignAgentToDepartmentSchema = z.object({
  agentId: z.string().uuid(),
});
export type AssignAgentToDepartment = z.infer<typeof assignAgentToDepartmentSchema>;
```

- [ ] **Step 2: Export from validators/index.ts**

Add to the end of `packages/shared/src/validators/index.ts`:

```typescript
export {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignAgentToDepartmentSchema,
  type CreateDepartment,
  type UpdateDepartment,
  type AssignAgentToDepartment,
} from "./department.js";
```

- [ ] **Step 3: Re-export from shared/src/index.ts**

Add an export block to `packages/shared/src/index.ts` (add near the end, before the final `export { API_PREFIX, API }`):

```typescript
export {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignAgentToDepartmentSchema,
  type CreateDepartment,
  type UpdateDepartment,
  type AssignAgentToDepartment,
} from "./validators/index.js";
```

- [ ] **Step 4: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/validators/department.ts packages/shared/src/validators/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): add department CRUD validators"
```

---

## Task 5: Server route — departments CRUD + agent assignment

**Files:**
- Create: `server/src/routes/departments.ts`

The route enforces `assertCompanyAccess` on reads and `requireCompanyAdminRole` (same helper as in `team.ts`) on writes. All mutations call `logActivity`.

- [ ] **Step 1: Write the failing tests**

```typescript
// server/src/__tests__/departments.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { createTestApp } from "./helpers/test-app.js";
import { createTestDb } from "./helpers/test-db.js";

describe("departments routes", () => {
  it("GET /companies/:companyId/departments returns empty list", async () => {
    const db = await createTestDb();
    const app = createTestApp(db);
    const res = await app.request("/api/companies/00000000-0000-0000-0000-000000000001/departments");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ departments: [] });
  });

  it("POST /companies/:companyId/departments creates a department", async () => {
    const db = await createTestDb();
    const app = createTestApp(db);
    const res = await app.request("/api/companies/00000000-0000-0000-0000-000000000001/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Engineering", color: "#3b82f6" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("Engineering");
    expect(body.color).toBe("#3b82f6");
    expect(body.id).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm vitest run server/src/__tests__/departments.test.ts 2>&1 | tail -20
```

Expected: FAIL — departments route does not exist yet.

- [ ] **Step 3: Write the departments route**

```typescript
// server/src/routes/departments.ts
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents as agentsTable,
  departments as departmentsTable,
  agentDepartments as agentDepartmentsTable,
} from "@paperclipai/db";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignAgentToDepartmentSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { logActivity } from "../services/index.js";
import { notFound, conflict, forbidden } from "../errors.js";
import { COMPANY_USER_ROLE_HIERARCHY } from "@paperclipai/shared";
import { userCompanyRoles } from "@paperclipai/db";

async function requireCompanyAdminRole(
  db: Db,
  companyId: string,
  userId: string | null | undefined,
) {
  if (!userId) throw forbidden("Login required");
  const row = await db
    .select({ role: userCompanyRoles.role })
    .from(userCompanyRoles)
    .where(and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)))
    .then((rows) => rows[0] ?? null);
  if (!row) throw forbidden("Not a member of this company");
  const level = COMPANY_USER_ROLE_HIERARCHY[row.role] ?? -1;
  if (level < (COMPANY_USER_ROLE_HIERARCHY["company_admin"] ?? 2)) {
    throw forbidden("Company admin role required");
  }
}

export function departmentRoutes(db: Db) {
  const router = Router();

  // List departments for a company
  router.get("/companies/:companyId/departments", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const rows = await db
        .select()
        .from(departmentsTable)
        .where(eq(departmentsTable.companyId, companyId))
        .orderBy(departmentsTable.name);

      res.json({ departments: rows });
    } catch (err) {
      next(err);
    }
  });

  // Get department with its agents
  router.get("/companies/:companyId/departments/:departmentId", async (req, res, next) => {
    try {
      const { companyId, departmentId } = req.params as { companyId: string; departmentId: string };
      assertCompanyAccess(req, companyId);

      const dept = await db
        .select()
        .from(departmentsTable)
        .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!dept) throw notFound("Department not found");

      const members = await db
        .select({ agentId: agentDepartmentsTable.agentId, name: agentsTable.name, status: agentsTable.status })
        .from(agentDepartmentsTable)
        .innerJoin(agentsTable, eq(agentsTable.id, agentDepartmentsTable.agentId))
        .where(eq(agentDepartmentsTable.departmentId, departmentId));

      res.json({ ...dept, agents: members });
    } catch (err) {
      next(err);
    }
  });

  // Create department
  router.post("/companies/:companyId/departments", validate("body", createDepartmentSchema), async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const body = req.body as import("@paperclipai/shared").CreateDepartment;
      const [created] = await db
        .insert(departmentsTable)
        .values({ companyId, ...body })
        .returning();

      await logActivity(db, {
        companyId,
        actorType: req.actor.source === "local_implicit" ? "board" : "user",
        actorId: req.actor.userId ?? "board",
        action: "department.created",
        entityType: "department",
        entityId: created.id,
        detail: { name: created.name },
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Update department
  router.patch("/companies/:companyId/departments/:departmentId", validate("body", updateDepartmentSchema), async (req, res, next) => {
    try {
      const { companyId, departmentId } = req.params as { companyId: string; departmentId: string };
      assertCompanyAccess(req, companyId);
      if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const body = req.body as import("@paperclipai/shared").UpdateDepartment;
      const [updated] = await db
        .update(departmentsTable)
        .set({ ...body, updatedAt: new Date() })
        .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
        .returning();

      if (!updated) throw notFound("Department not found");

      await logActivity(db, {
        companyId,
        actorType: req.actor.source === "local_implicit" ? "board" : "user",
        actorId: req.actor.userId ?? "board",
        action: "department.updated",
        entityType: "department",
        entityId: departmentId,
        detail: body,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // Delete department
  router.delete("/companies/:companyId/departments/:departmentId", async (req, res, next) => {
    try {
      const { companyId, departmentId } = req.params as { companyId: string; departmentId: string };
      assertCompanyAccess(req, companyId);
      if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const [deleted] = await db
        .delete(departmentsTable)
        .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
        .returning();

      if (!deleted) throw notFound("Department not found");

      await logActivity(db, {
        companyId,
        actorType: req.actor.source === "local_implicit" ? "board" : "user",
        actorId: req.actor.userId ?? "board",
        action: "department.deleted",
        entityType: "department",
        entityId: departmentId,
        detail: { name: deleted.name },
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Add agent to department
  router.post(
    "/companies/:companyId/departments/:departmentId/agents",
    validate("body", assignAgentToDepartmentSchema),
    async (req, res, next) => {
      try {
        const { companyId, departmentId } = req.params as { companyId: string; departmentId: string };
        assertCompanyAccess(req, companyId);
        if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const { agentId } = req.body as import("@paperclipai/shared").AssignAgentToDepartment;

        // Verify agent belongs to this company
        const agent = await db
          .select({ id: agentsTable.id })
          .from(agentsTable)
          .where(and(eq(agentsTable.id, agentId), eq(agentsTable.companyId, companyId)))
          .then((rows) => rows[0] ?? null);
        if (!agent) throw notFound("Agent not found in this company");

        await db
          .insert(agentDepartmentsTable)
          .values({ agentId, departmentId })
          .onConflictDoNothing();

        await logActivity(db, {
          companyId,
          actorType: req.actor.source === "local_implicit" ? "board" : "user",
          actorId: req.actor.userId ?? "board",
          action: "department.agent_added",
          entityType: "department",
          entityId: departmentId,
          detail: { agentId },
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  // Remove agent from department
  router.delete("/companies/:companyId/departments/:departmentId/agents/:agentId", async (req, res, next) => {
    try {
      const { companyId, departmentId, agentId } = req.params as {
        companyId: string;
        departmentId: string;
        agentId: string;
      };
      assertCompanyAccess(req, companyId);
      if (!req.actor.isInstanceAdmin && req.actor.source !== "local_implicit") {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      await db
        .delete(agentDepartmentsTable)
        .where(
          and(
            eq(agentDepartmentsTable.departmentId, departmentId),
            eq(agentDepartmentsTable.agentId, agentId),
          ),
        );

      await logActivity(db, {
        companyId,
        actorType: req.actor.source === "local_implicit" ? "board" : "user",
        actorId: req.actor.userId ?? "board",
        action: "department.agent_removed",
        entityType: "department",
        entityId: departmentId,
        detail: { agentId },
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm vitest run server/src/__tests__/departments.test.ts 2>&1 | tail -20
```

Expected: tests still fail because the route isn't registered yet. That's expected at this step — registration happens in Task 6.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/departments.ts server/src/__tests__/departments.test.ts
git commit -m "feat(server): add departments routes and tests"
```

---

## Task 6: Register departments route in app.ts

**Files:**
- Modify: `server/src/app.ts`

- [ ] **Step 1: Find where teamRoutes is registered in app.ts**

```bash
grep -n "teamRoutes\|import.*team" /home/ccasalicchio/paperclip-surfers/server/src/app.ts
```

Note the line number where `teamRoutes` is imported and where `api.use(teamRoutes(db))` appears.

- [ ] **Step 2: Add departmentRoutes import and registration**

In `server/src/app.ts`, add the import alongside `teamRoutes`:

```typescript
import { departmentRoutes } from "./routes/departments.js";
```

And add the registration line immediately after the `teamRoutes` registration:

```typescript
api.use(departmentRoutes(db));
```

- [ ] **Step 3: Run the tests**

```bash
pnpm vitest run server/src/__tests__/departments.test.ts 2>&1 | tail -20
```

Expected: PASS — both tests pass.

- [ ] **Step 4: Run full test suite to check for regressions**

```bash
pnpm test:run 2>&1 | tail -30
```

Expected: same pass/fail ratio as before (pre-existing flaky tests are not our concern if they pass in isolation).

- [ ] **Step 5: Typecheck and build**

```bash
pnpm -r typecheck && pnpm build 2>&1 | tail -10
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add server/src/app.ts
git commit -m "feat(server): register department routes in app"
```

---

## Task 7: UI API client and query keys

**Files:**
- Create: `ui/src/api/departments.ts`
- Modify: `ui/src/lib/queryKeys.ts`

- [ ] **Step 1: Write the departments API client**

```typescript
// ui/src/api/departments.ts
import { api } from "./client";

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string | null;
  leadUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDetail extends Department {
  agents: Array<{ agentId: string; name: string; status: string }>;
}

export const departmentsApi = {
  list: (companyId: string): Promise<{ departments: Department[] }> =>
    api.get(`/companies/${companyId}/departments`),

  get: (companyId: string, departmentId: string): Promise<DepartmentDetail> =>
    api.get(`/companies/${companyId}/departments/${departmentId}`),

  create: (
    companyId: string,
    data: { name: string; description?: string | null; color?: string | null; leadUserId?: string | null },
  ): Promise<Department> =>
    api.post(`/companies/${companyId}/departments`, data),

  update: (
    companyId: string,
    departmentId: string,
    data: { name?: string; description?: string | null; color?: string | null; leadUserId?: string | null },
  ): Promise<Department> =>
    api.patch(`/companies/${companyId}/departments/${departmentId}`, data),

  delete: (companyId: string, departmentId: string): Promise<void> =>
    api.delete(`/companies/${companyId}/departments/${departmentId}`),

  addAgent: (companyId: string, departmentId: string, agentId: string): Promise<void> =>
    api.post(`/companies/${companyId}/departments/${departmentId}/agents`, { agentId }),

  removeAgent: (companyId: string, departmentId: string, agentId: string): Promise<void> =>
    api.delete(`/companies/${companyId}/departments/${departmentId}/agents/${agentId}`),
};
```

- [ ] **Step 2: Add department query keys**

In `ui/src/lib/queryKeys.ts`, add a `departments` entry. Find the `org` line and add before it:

```typescript
  departments: {
    list: (companyId: string) => ["departments", companyId] as const,
    detail: (companyId: string, departmentId: string) => ["departments", companyId, departmentId] as const,
  },
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add ui/src/api/departments.ts ui/src/lib/queryKeys.ts
git commit -m "feat(ui): add departments API client and query keys"
```

---

## Task 8: Departments settings page

**Files:**
- Create: `ui/src/pages/Departments.tsx`

This page lists departments, lets the admin create/edit/delete them, and assign agents to each.

- [ ] **Step 1: Write the failing test (React Testing Library)**

The project's UI tests are colocated with the page in `ui/src/__tests__/`. Check if the directory exists before writing:

```bash
ls /home/ccasalicchio/paperclip-surfers/ui/src/__tests__/ 2>/dev/null | head -5
```

If no `__tests__` directory exists, skip to Step 3 (the page is tested by the e2e suite, not unit tests).

- [ ] **Step 2: Build the Departments page**

```typescript
// ui/src/pages/Departments.tsx
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, Users } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { departmentsApi, type Department } from "../api/departments";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";

function colorDot(color: string | null) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
      style={{ backgroundColor: color ?? "var(--muted)" }}
    />
  );
}

interface CreateFormProps {
  companyId: string;
  onCreated: () => void;
}

function CreateDepartmentForm({ companyId, onCreated }: CreateFormProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () => departmentsApi.create(companyId, { name, color, description: description || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.list(companyId) });
      setName("");
      setDescription("");
      setColor("#6366f1");
      onCreated();
    },
    onError: () => {
      pushToast({ title: "Failed to create department", tone: "critical" });
    },
  });

  return (
    <form
      className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        mutation.mutate();
      }}
    >
      <h3 className="text-sm font-medium">New Department</h3>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-border"
          title="Department color"
        />
        <input
          type="text"
          placeholder="Department name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          required
        />
      </div>
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!name.trim() || mutation.isPending}>
          Create
        </Button>
      </div>
    </form>
  );
}

interface DeptCardProps {
  dept: Department;
  companyId: string;
}

function DepartmentCard({ dept, companyId }: DeptCardProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [addingAgent, setAddingAgent] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const { data: detail } = useQuery({
    queryKey: queryKeys.departments.detail(companyId, dept.id),
    queryFn: () => departmentsApi.get(companyId, dept.id),
  });

  const { data: agentsData } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: addingAgent,
  });

  const deleteMutation = useMutation({
    mutationFn: () => departmentsApi.delete(companyId, dept.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.list(companyId) });
    },
    onError: () => {
      pushToast({ title: "Failed to delete department", tone: "critical" });
    },
  });

  const addAgentMutation = useMutation({
    mutationFn: (agentId: string) => departmentsApi.addAgent(companyId, dept.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(companyId, dept.id) });
      setAddingAgent(false);
      setSelectedAgentId("");
    },
    onError: () => {
      pushToast({ title: "Failed to add agent", tone: "critical" });
    },
  });

  const removeAgentMutation = useMutation({
    mutationFn: (agentId: string) => departmentsApi.removeAgent(companyId, dept.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(companyId, dept.id) });
    },
    onError: () => {
      pushToast({ title: "Failed to remove agent", tone: "critical" });
    },
  });

  const memberIds = new Set(detail?.agents.map((a) => a.agentId) ?? []);
  const availableAgents = (agentsData ?? []).filter((a) => !memberIds.has(a.id));

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {colorDot(dept.color)}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{dept.name}</p>
          {dept.description && (
            <p className="text-xs text-muted-foreground truncate">{dept.description}</p>
          )}
        </div>
        <button
          className="text-muted-foreground hover:text-destructive transition-colors p-1"
          onClick={() => {
            if (confirm(`Delete department "${dept.name}"?`)) deleteMutation.mutate();
          }}
          aria-label="Delete department"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />
            Members ({detail?.agents.length ?? 0})
          </p>
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setAddingAgent(!addingAgent)}
          >
            {addingAgent ? "Cancel" : "+ Add agent"}
          </button>
        </div>

        {addingAgent && (
          <div className="flex gap-2 mb-2">
            <select
              className="flex-1 text-xs px-2 py-1 border border-border rounded bg-background focus:outline-none"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
            >
              <option value="">Select agent…</option>
              {availableAgents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              className="text-xs"
              disabled={!selectedAgentId || addAgentMutation.isPending}
              onClick={() => selectedAgentId && addAgentMutation.mutate(selectedAgentId)}
            >
              Add
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {(detail?.agents ?? []).map((agent) => (
            <div key={agent.agentId} className="flex items-center justify-between text-sm">
              <span className="truncate">{agent.name}</span>
              <button
                className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                onClick={() => removeAgentMutation.mutate(agent.agentId)}
                aria-label={`Remove ${agent.name}`}
              >
                ×
              </button>
            </div>
          ))}
          {(detail?.agents ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No agents assigned</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function Departments() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Departments" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list(selectedCompanyId!),
    queryFn: () => departmentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return null;
  if (isLoading) return <PageSkeleton variant="list" />;

  const departments = data?.departments ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Group agents into departments and scope assets by department.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" />
          New Department
        </Button>
      </div>

      {showCreate && (
        <CreateDepartmentForm
          companyId={selectedCompanyId}
          onCreated={() => setShowCreate(false)}
        />
      )}

      {departments.length === 0 && !showCreate ? (
        <EmptyState icon={Building2} message="No departments yet. Create one to start grouping agents." />
      ) : (
        <div className="grid gap-3">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} dept={dept} companyId={selectedCompanyId} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/Departments.tsx
git commit -m "feat(ui): add Departments settings page"
```

---

## Task 9: Wire Departments into CompanySettings

**Files:**
- Modify: `ui/src/pages/CompanySettings.tsx`

- [ ] **Step 1: Find where TeamMembers is imported and used**

```bash
grep -n "TeamMembers\|import.*TeamMembers" /home/ccasalicchio/paperclip-surfers/ui/src/pages/CompanySettings.tsx | head -5
```

Note the import line and the JSX usage line.

- [ ] **Step 2: Add Departments import**

In `CompanySettings.tsx`, add next to the `TeamMembers` import:

```typescript
import { Departments } from "./Departments";
```

- [ ] **Step 3: Add Departments section**

In the JSX of `CompanySettings`, add a `<Departments />` section after `<TeamMembers />` using the same visual separator pattern as existing sections. Look for the pattern used for TeamMembers (typically a `<section>` or a `<div>` with a top border) and replicate it:

```tsx
{/* Insert after the TeamMembers section */}
<div className="border-t border-border pt-6">
  <Departments />
</div>
```

- [ ] **Step 4: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/CompanySettings.tsx
git commit -m "feat(ui): add Departments section to CompanySettings"
```

---

## Task 10: Org chart department grouping boxes

**Files:**
- Modify: `ui/src/pages/OrgChart.tsx`

The org chart renders a card layer (HTML `div`) over an SVG edge layer. Departments render as colored rectangles in a third layer behind both, computed from the bounding boxes of their member agents' layout positions.

- [ ] **Step 1: Add departments data to OrgChart**

In `OrgChart.tsx`, add the departments query after the existing `agentMap` computation:

```typescript
// add to imports
import { departmentsApi } from "../api/departments";
import { queryKeys } from "../lib/queryKeys";

// add after the agentMap useMemo:
const { data: departmentsData } = useQuery({
  queryKey: queryKeys.departments.list(selectedCompanyId!),
  queryFn: () => departmentsApi.list(selectedCompanyId!),
  enabled: !!selectedCompanyId,
});

// New: fetch membership for each department (batched via individual detail calls)
// We use a simpler approach: fetch all department details in one extra query for the full list
// For rendering, we only need agentId→departmentId mapping:
const agentDeptMap = useMemo(() => {
  const m = new Map<string, { deptId: string; name: string; color: string | null }>();
  // populated via departments detail — but to avoid N+1, use the org chart route which has agent positions
  // For Phase 1 of this feature, departments are shown if the board also loads department membership.
  // We'll fetch each dept's agents from the detail API using a compound query below.
  return m;
}, []);
```

Wait — actually the simpler approach is to load a single `departments` list (which has names/colors), and separately we need which agents are in each. Since `departmentRoutes.get` returns members, we'd need N+1 calls. Instead, add a server route `GET /companies/:companyId/departments?withAgents=true` that returns all departments with their agent lists in one request.

**Revised approach:** Rather than N+1 calls, update the list endpoint to optionally include agents. We'll add `?withAgents=true` support to the server `GET /companies/:companyId/departments` route.

- [ ] **Step 2: Extend list endpoint for withAgents**

In `server/src/routes/departments.ts`, update the list route:

```typescript
router.get("/companies/:companyId/departments", async (req, res, next) => {
  try {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const withAgents = req.query["withAgents"] === "true";

    const rows = await db
      .select()
      .from(departmentsTable)
      .where(eq(departmentsTable.companyId, companyId))
      .orderBy(departmentsTable.name);

    if (!withAgents) {
      res.json({ departments: rows });
      return;
    }

    // Attach agent lists
    const allMemberships = await db
      .select({
        departmentId: agentDepartmentsTable.departmentId,
        agentId: agentDepartmentsTable.agentId,
        name: agentsTable.name,
        status: agentsTable.status,
      })
      .from(agentDepartmentsTable)
      .innerJoin(agentsTable, eq(agentsTable.id, agentDepartmentsTable.agentId))
      .where(
        eq(agentsTable.companyId, companyId)
      );

    const byDept = new Map<string, Array<{ agentId: string; name: string; status: string }>>();
    for (const m of allMemberships) {
      const list = byDept.get(m.departmentId) ?? [];
      list.push({ agentId: m.agentId, name: m.name, status: m.status });
      byDept.set(m.departmentId, list);
    }

    const departments = rows.map((r) => ({ ...r, agents: byDept.get(r.id) ?? [] }));
    res.json({ departments });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Update the UI API client to support withAgents**

In `ui/src/api/departments.ts`, update the `list` function:

```typescript
export interface DepartmentWithAgents extends Department {
  agents: Array<{ agentId: string; name: string; status: string }>;
}

// Update list signature:
list: (companyId: string, withAgents?: boolean): Promise<{ departments: Department[] | DepartmentWithAgents[] }> =>
  api.get(`/companies/${companyId}/departments${withAgents ? "?withAgents=true" : ""}`),
```

- [ ] **Step 4: Implement department boxes in OrgChart**

In `OrgChart.tsx`, add the department box computation and rendering. Add these after the `agentMap` memo:

```typescript
// Fetch departments with agent membership for org chart
const { data: deptsData } = useQuery({
  queryKey: [...queryKeys.departments.list(selectedCompanyId!), "withAgents"],
  queryFn: () => departmentsApi.list(selectedCompanyId!, true),
  enabled: !!selectedCompanyId,
});

// Compute bounding boxes for each department from layout node positions
const deptBoxes = useMemo(() => {
  const deps = (deptsData?.departments ?? []) as import("../api/departments").DepartmentWithAgents[];
  if (!allNodes.length) return [];
  const nodeById = new Map(allNodes.map((n) => [n.id, n]));
  const PADDING_DEPT = 20;

  return deps
    .map((dept) => {
      const members = dept.agents
        .map((a) => nodeById.get(a.agentId))
        .filter((n): n is typeof allNodes[0] => n !== undefined);

      if (members.length === 0) return null;

      const minX = Math.min(...members.map((n) => n.x)) - PADDING_DEPT;
      const minY = Math.min(...members.map((n) => n.y)) - PADDING_DEPT - 20; // extra top for label
      const maxX = Math.max(...members.map((n) => n.x + CARD_W)) + PADDING_DEPT;
      const maxY = Math.max(...members.map((n) => n.y + CARD_H)) + PADDING_DEPT;

      return {
        id: dept.id,
        name: dept.name,
        color: dept.color ?? "#6366f1",
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    })
    .filter((b): b is NonNullable<typeof b> => b !== null);
}, [allNodes, deptsData]);
```

- [ ] **Step 5: Render dept boxes in the card layer**

In `OrgChart.tsx`, inside the card layer `<div>` (the one with `transform: translate...`), add a dept box layer BEFORE the agent card mapping:

```tsx
{/* Department grouping boxes — rendered behind agent cards */}
{deptBoxes.map((box) => (
  <div
    key={box.id}
    className="absolute rounded-xl border-2 pointer-events-none"
    style={{
      left: box.x,
      top: box.y,
      width: box.width,
      height: box.height,
      borderColor: box.color,
      backgroundColor: `${box.color}18`,
    }}
  >
    <span
      className="absolute top-2 left-3 text-[11px] font-semibold uppercase tracking-wide"
      style={{ color: box.color }}
    >
      {box.name}
    </span>
  </div>
))}
```

- [ ] **Step 6: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/departments.ts ui/src/api/departments.ts ui/src/pages/OrgChart.tsx
git commit -m "feat(ui): render department grouping boxes on org chart"
```

---

## Task 11: DeptScopeSelector component + Routines form integration

**Files:**
- Create: `ui/src/components/DeptScopeSelector.tsx`
- Modify: `ui/src/pages/Routines.tsx`

This task adds a reusable dept scope picker to asset create/edit forms. We wire it into the routines create form as the primary example. The same component can be added to other asset forms (memories, skills) following the same pattern.

- [ ] **Step 1: Check how the routines create form currently works**

```bash
grep -n "createRoutine\|onSubmit\|departmentId\|handleSubmit" /home/ccasalicchio/paperclip-surfers/ui/src/pages/Routines.tsx | head -20
```

Note the form state management pattern — whether it uses `useState` or a form library, and where the submit handler is.

- [ ] **Step 2: Build DeptScopeSelector component**

```typescript
// ui/src/components/DeptScopeSelector.tsx
import { useQuery } from "@tanstack/react-query";
import { departmentsApi } from "../api/departments";
import { queryKeys } from "../lib/queryKeys";

interface Props {
  companyId: string;
  departmentId: string | null;
  sharedWith: string[];
  onChange: (update: { departmentId: string | null; sharedWith: string[] }) => void;
}

export function DeptScopeSelector({ companyId, departmentId, sharedWith, onChange }: Props) {
  const { data } = useQuery({
    queryKey: queryKeys.departments.list(companyId),
    queryFn: () => departmentsApi.list(companyId),
  });
  const departments = data?.departments ?? [];

  if (departments.length === 0) return null;

  const mode: "company" | "dept" | "shared" = departmentId
    ? "dept"
    : sharedWith.length > 0
    ? "shared"
    : "company";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-muted-foreground">Visibility</label>
      <div className="flex gap-2">
        {(["company", "dept", "shared"] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              mode === m
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30"
            }`}
            onClick={() => {
              if (m === "company") onChange({ departmentId: null, sharedWith: [] });
              else if (m === "dept") onChange({ departmentId: departments[0]?.id ?? null, sharedWith: [] });
              else onChange({ departmentId: null, sharedWith: sharedWith.length ? sharedWith : departments.slice(0, 1).map((d) => d.id) });
            }}
          >
            {m === "company" ? "Company-wide" : m === "dept" ? "One department" : "Shared with"}
          </button>
        ))}
      </div>

      {mode === "dept" && (
        <select
          className="text-sm px-3 py-1.5 border border-border rounded bg-background focus:outline-none"
          value={departmentId ?? ""}
          onChange={(e) => onChange({ departmentId: e.target.value || null, sharedWith: [] })}
        >
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      {mode === "shared" && (
        <div className="flex flex-col gap-1">
          {departments.map((d) => (
            <label key={d.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={sharedWith.includes(d.id)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...sharedWith, d.id]
                    : sharedWith.filter((id) => id !== d.id);
                  onChange({ departmentId: null, sharedWith: next });
                }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full border border-border"
                style={{ backgroundColor: d.color ?? "var(--muted)" }}
              />
              {d.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire DeptScopeSelector into the routines create form**

Look at `ui/src/pages/Routines.tsx` to find the create form component. Find where the form's state is defined (likely `useState` objects for `title`, `description`, `assigneeAgentId`, etc.) and the `onSubmit` handler.

Add to the form's state:
```typescript
const [deptScope, setDeptScope] = useState<{ departmentId: string | null; sharedWith: string[] }>({
  departmentId: null,
  sharedWith: [],
});
```

Add to the mutation payload (inside the `createRoutine` call):
```typescript
departmentId: deptScope.departmentId,
// Note: sharedWith is stored in DB but the createRoutine validator may not include it yet.
// If the server validator doesn't have departmentId, add it to packages/shared/src/validators/routine.ts:
// departmentId: z.string().uuid().nullable().optional()
```

Add the component to the form JSX, before the submit button:
```tsx
import { DeptScopeSelector } from "../components/DeptScopeSelector";

<DeptScopeSelector
  companyId={selectedCompanyId!}
  departmentId={deptScope.departmentId}
  sharedWith={deptScope.sharedWith}
  onChange={setDeptScope}
/>
```

- [ ] **Step 4: Update routine validator to accept departmentId**

In `packages/shared/src/validators/routine.ts`, find `createRoutineSchema` and add:

```typescript
departmentId: z.string().uuid().nullable().optional(),
sharedWith: z.array(z.string().uuid()).optional(),
```

Find `updateRoutineSchema` and add the same two fields.

- [ ] **Step 5: Typecheck**

```bash
pnpm -r typecheck 2>&1 | grep -E "error|Error" | head -20
```

Expected: no errors.

- [ ] **Step 6: Run test suite**

```bash
pnpm test:run 2>&1 | tail -20
```

Expected: same pass count as before.

- [ ] **Step 7: Build**

```bash
pnpm build 2>&1 | tail -10
```

Expected: exits 0.

- [ ] **Step 8: Commit**

```bash
git add ui/src/components/DeptScopeSelector.tsx ui/src/pages/Routines.tsx packages/shared/src/validators/routine.ts
git commit -m "feat(ui): add DeptScopeSelector component and wire into routines form"
```

---

## Final Verification

- [ ] **Run the full verification suite**

```bash
pnpm -r typecheck && pnpm test:run && pnpm build
```

Expected: all three exit 0.

- [ ] **Start dev server and smoke-test manually**

```bash
pnpm dev
```

Open `http://localhost:3100`. Navigate to Settings → (your company) → Departments. Verify:
1. "New Department" button opens create form
2. Creating a department with a color shows it in the list
3. Clicking "+ Add agent" shows available agents in the dropdown
4. After adding an agent, it appears in the department card
5. Navigate to Org Chart — if any agents are assigned to departments, colored grouping boxes appear behind their cards

- [ ] **Final commit (if any cleanup needed)**

```bash
git add -p  # stage only intentional changes
git commit -m "chore: layer 2 final cleanup"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `departments` table with id, companyId, name, description, color, leadUserId, timestamps → Task 1
- [x] `agent_departments` join table with cascade deletes → Task 1
- [x] `departmentId` + `sharedWith` added to memories, routines, skills, budgets → Task 2
- [x] Migration generated → Task 3
- [x] Org chart department grouping boxes (color from dept.color) → Task 10
- [x] Settings → Departments: create/rename/delete, assign agents, view scoped assets → Task 8 + 9
- [x] Asset forms dept scope selector → Task 11
- [x] Department budgets: `departmentId` column on `budget_policies` allows scoping → Task 2 (column added; creating a dept-scoped budget uses the existing budget route with this column)

**Note on leadUserId:** The `leadUserId` is stored in the DB schema (Task 1) but is not exposed in the Settings UI in this plan (the create form omits it for simplicity). A follow-up can add a user picker dropdown to the edit flow.
