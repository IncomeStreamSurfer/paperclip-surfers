# Foundation Layer 1 — Multi-user Auth + Roles + Invitations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add company-scoped user roles (company_admin / manager / viewer) and an email-based invitation flow so multiple humans can collaborate in Paperclip with role-appropriate access.

**Architecture:** Two new DB tables (`user_company_roles`, `user_invitations`) alongside the existing Better Auth `authUsers` table. New `/team` routes handle invite + CRUD. Accept-invite is a two-step UI flow: Better Auth signup first, then a claim call. The first user who registers is auto-promoted to instance_admin (maps to super_admin in the Pro+ role hierarchy). Existing `assertCompanyAccess` is not changed — it remains the board-level gate. The new role check lives only on the new team-management routes.

**Tech Stack:** Drizzle ORM + PGlite, Express 5, React 19, TanStack Query, TypeScript strict, pnpm workspaces, Vitest, Zod

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/db/src/schema/user_company_roles.ts` | Drizzle table: userId × companyId → role |
| Create | `packages/db/src/schema/user_invitations.ts` | Drizzle table: pending email invitations |
| Modify | `packages/db/src/schema/index.ts` | Export new tables |
| Modify | `packages/shared/src/constants.ts` | Add `COMPANY_USER_ROLES` constant |
| Modify | `packages/shared/src/validators/access.ts` | Add invite / role update validators |
| Modify | `packages/shared/src/validators/index.ts` | Re-export new validators |
| Create | `server/src/routes/team.ts` | All team-management API routes |
| Modify | `server/src/app.ts` | Register team routes |
| Create | `ui/src/api/team.ts` | Typed fetch wrappers for team endpoints |
| Create | `ui/src/pages/TeamMembers.tsx` | Settings tab: list / invite / change-role / revoke |
| Create | `ui/src/pages/AcceptUserInvite.tsx` | Accept-invite page: sign up + claim |
| Modify | `ui/src/App.tsx` | Add `/accept-user-invite/:token` route |
| Modify | `ui/src/pages/CompanySettings.tsx` | Add "Team" tab wired to TeamMembers page |
| Modify | `server/src/auth/better-auth.ts` | Post-signup hook: first user → instance_admin |

---

## Task 1: DB Schema — user_company_roles table

**Files:**
- Create: `packages/db/src/schema/user_company_roles.ts`

- [ ] **Step 1: Write the schema file**

```typescript
// packages/db/src/schema/user_company_roles.ts
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const userCompanyRoles = pgTable(
  "user_company_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCompanyUniq: uniqueIndex("user_company_roles_user_company_uniq").on(
      table.userId,
      table.companyId,
    ),
    companyIdx: index("user_company_roles_company_idx").on(table.companyId),
    userIdx: index("user_company_roles_user_idx").on(table.userId),
  }),
);
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter @paperclipai/db exec tsc --noEmit 2>&1 | head -20`
Expected: No errors from `user_company_roles.ts`

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/user_company_roles.ts
git commit -m "feat(db): add user_company_roles schema"
```

---

## Task 2: DB Schema — user_invitations table

**Files:**
- Create: `packages/db/src/schema/user_invitations.ts`

- [ ] **Step 1: Write the schema file**

```typescript
// packages/db/src/schema/user_invitations.ts
import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    token: uuid("token").notNull().defaultRandom(),
    invitedByUserId: text("invited_by_user_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUniq: uniqueIndex("user_invitations_token_uniq").on(table.token),
    companyEmailIdx: index("user_invitations_company_email_idx").on(table.companyId, table.email),
    companyActiveIdx: index("user_invitations_company_active_idx").on(
      table.companyId,
      table.acceptedAt,
      table.revokedAt,
    ),
  }),
);
```

- [ ] **Step 2: Export both new tables from schema index**

In `packages/db/src/schema/index.ts`, add at the end:

```typescript
export { userCompanyRoles } from "./user_company_roles.js";
export { userInvitations } from "./user_invitations.js";
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter @paperclipai/db exec tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/user_invitations.ts packages/db/src/schema/index.ts
git commit -m "feat(db): add user_invitations schema and export new tables"
```

---

## Task 3: Generate and inspect the migration

**Files:**
- New migration file auto-generated under `packages/db/src/migrations/`

- [ ] **Step 1: Run migration generator**

```bash
cd /home/ccasalicchio/paperclip-surfers && pnpm db:generate
```

Expected: A new `packages/db/src/migrations/0048_*.sql` file is created with two `CREATE TABLE` statements (user_company_roles, user_invitations) and their indexes.

- [ ] **Step 2: Inspect the generated migration**

```bash
cat packages/db/src/migrations/$(ls packages/db/src/migrations/*.sql | sort | tail -1 | xargs basename)
```

Verify it contains:
- `CREATE TABLE "user_company_roles"` with all columns
- `CREATE TABLE "user_invitations"` with all columns
- All indexes

- [ ] **Step 3: Commit the migration**

```bash
git add packages/db/src/migrations/
git commit -m "feat(db): migration — user_company_roles and user_invitations tables"
```

---

## Task 4: Shared constants + validators

**Files:**
- Modify: `packages/shared/src/constants.ts`
- Modify: `packages/shared/src/validators/access.ts`
- Modify: `packages/shared/src/validators/index.ts`

- [ ] **Step 1: Add COMPANY_USER_ROLES to constants.ts**

In `packages/shared/src/constants.ts`, add after the `PERMISSION_KEYS` block (around line 352):

```typescript
export const COMPANY_USER_ROLES = ["company_admin", "manager", "viewer"] as const;
export type CompanyUserRole = (typeof COMPANY_USER_ROLES)[number];

export const COMPANY_USER_ROLE_HIERARCHY: Record<string, number> = {
  viewer: 0,
  manager: 1,
  company_admin: 2,
};
```

- [ ] **Step 2: Add validators to validators/access.ts**

In `packages/shared/src/validators/access.ts`, add after the existing imports:

```typescript
import { COMPANY_USER_ROLES } from "../constants.js";
```

Add these schemas at the end of the file:

```typescript
export const inviteUserSchema = z.object({
  email: z.string().email().max(320),
  role: z.enum(COMPANY_USER_ROLES),
});
export type InviteUser = z.infer<typeof inviteUserSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(COMPANY_USER_ROLES),
});
export type UpdateUserRole = z.infer<typeof updateUserRoleSchema>;
```

- [ ] **Step 3: Export new validators from validators/index.ts**

In `packages/shared/src/validators/index.ts`, the access module is already re-exported. Verify it uses `export * from "./access.js"` — if it does, the new exports are automatic. If it lists named exports, add `inviteUserSchema`, `updateUserRoleSchema` and their types.

Run: `grep "access" packages/shared/src/validators/index.ts`

If the output shows `export * from "./access.js"`, no change needed. If it shows specific named exports, append `inviteUserSchema, InviteUser, updateUserRoleSchema, UpdateUserRole` to that line.

- [ ] **Step 4: Typecheck shared package**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter @paperclipai/shared exec tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants.ts packages/shared/src/validators/access.ts packages/shared/src/validators/index.ts
git commit -m "feat(shared): COMPANY_USER_ROLES constant and invite/role validators"
```

---

## Task 5: Server routes — team management

**Files:**
- Create: `server/src/routes/team.ts`

This file handles all team-member operations. Role check logic lives inline in each handler (no separate middleware file needed — this keeps it close to the DB calls and avoids making authz.ts async).

- [ ] **Step 1: Write server/src/routes/team.ts**

```typescript
// server/src/routes/team.ts
import { Router } from "express";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  authUsers,
  companies,
  userCompanyRoles,
  userInvitations,
} from "@paperclipai/db";
import {
  COMPANY_USER_ROLE_HIERARCHY,
  inviteUserSchema,
  updateUserRoleSchema,
} from "@paperclipai/shared";
import { forbidden, notFound, badRequest, conflict } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";

const USER_INVITATION_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

function isCompanyAdmin(req: { actor: { isInstanceAdmin?: boolean; source?: string; userId?: string | null } }) {
  return req.actor.isInstanceAdmin || req.actor.source === "local_implicit";
}

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
  if (level < COMPANY_USER_ROLE_HIERARCHY.company_admin!) {
    throw forbidden("Company admin role required");
  }
}

export function teamRoutes(db: Db) {
  const router = Router();

  // GET /companies/:companyId/team
  // Lists all users with roles in this company.
  router.get("/companies/:companyId/team", async (req, res, next) => {
    try {
      assertCompanyAccess(req, req.params.companyId!);
      const { companyId } = req.params as { companyId: string };

      const rows = await db
        .select({
          userId: userCompanyRoles.userId,
          role: userCompanyRoles.role,
          createdAt: userCompanyRoles.createdAt,
          name: authUsers.name,
          email: authUsers.email,
        })
        .from(userCompanyRoles)
        .leftJoin(authUsers, eq(userCompanyRoles.userId, authUsers.id))
        .where(eq(userCompanyRoles.companyId, companyId))
        .orderBy(userCompanyRoles.createdAt);

      res.json({ members: rows });
    } catch (err) {
      next(err);
    }
  });

  // POST /companies/:companyId/team/invite
  // Creates a user_invitations row. Actual email sending is a no-op placeholder until Layer 4 (email).
  router.post(
    "/companies/:companyId/team/invite",
    validate(inviteUserSchema),
    async (req, res, next) => {
      try {
        assertCompanyAccess(req, req.params.companyId!);
        const { companyId } = req.params as { companyId: string };

        if (!isCompanyAdmin(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const { email, role } = req.body as { email: string; role: string };

        // Check for an active pending invitation for the same email + company
        const existing = await db
          .select({ id: userInvitations.id })
          .from(userInvitations)
          .where(
            and(
              eq(userInvitations.companyId, companyId),
              eq(userInvitations.email, email.toLowerCase()),
              isNull(userInvitations.acceptedAt),
              isNull(userInvitations.revokedAt),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          throw conflict("An active invitation for this email already exists");
        }

        const [invite] = await db
          .insert(userInvitations)
          .values({
            email: email.toLowerCase(),
            companyId,
            role,
            invitedByUserId: req.actor.userId ?? null,
            expiresAt: new Date(Date.now() + USER_INVITATION_TTL_MS),
          })
          .returning();

        res.status(201).json({
          invitation: {
            id: invite!.id,
            email: invite!.email,
            role: invite!.role,
            token: invite!.token,
            expiresAt: invite!.expiresAt,
            acceptLink: `/accept-user-invite/${invite!.token}`,
          },
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // PATCH /companies/:companyId/team/:userId/role
  // Changes a member's role. Requires company_admin.
  router.patch(
    "/companies/:companyId/team/:userId/role",
    validate(updateUserRoleSchema),
    async (req, res, next) => {
      try {
        assertCompanyAccess(req, req.params.companyId!);
        const { companyId, userId } = req.params as { companyId: string; userId: string };

        if (!isCompanyAdmin(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const { role } = req.body as { role: string };

        const [updated] = await db
          .update(userCompanyRoles)
          .set({ role, updatedAt: new Date() })
          .where(
            and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)),
          )
          .returning();

        if (!updated) throw notFound("Member not found");

        res.json({ member: updated });
      } catch (err) {
        next(err);
      }
    },
  );

  // DELETE /companies/:companyId/team/:userId
  // Removes a member from the company. Requires company_admin.
  router.delete("/companies/:companyId/team/:userId", async (req, res, next) => {
    try {
      assertCompanyAccess(req, req.params.companyId!);
      const { companyId, userId } = req.params as { companyId: string; userId: string };

      if (!isCompanyAdmin(req)) {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const [deleted] = await db
        .delete(userCompanyRoles)
        .where(
          and(eq(userCompanyRoles.userId, userId), eq(userCompanyRoles.companyId, companyId)),
        )
        .returning();

      if (!deleted) throw notFound("Member not found");

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  });

  // GET /user-invitations/:token
  // Public — returns invite details needed to render the accept page.
  router.get("/user-invitations/:token", async (req, res, next) => {
    try {
      const { token } = req.params as { token: string };

      const invite = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          expiresAt: userInvitations.expiresAt,
          acceptedAt: userInvitations.acceptedAt,
          revokedAt: userInvitations.revokedAt,
          companyName: companies.name,
        })
        .from(userInvitations)
        .leftJoin(companies, eq(userInvitations.companyId, companies.id))
        .where(eq(userInvitations.token, token))
        .then((rows) => rows[0] ?? null);

      if (!invite) throw notFound("Invitation not found");
      if (invite.revokedAt) throw badRequest("This invitation has been revoked");
      if (invite.acceptedAt) throw badRequest("This invitation has already been accepted");
      if (new Date(invite.expiresAt) < new Date()) throw badRequest("This invitation has expired");

      res.json({
        invitation: {
          email: invite.email,
          role: invite.role,
          companyName: invite.companyName,
          expiresAt: invite.expiresAt,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  // POST /user-invitations/:token/claim
  // Authenticated. Called after the user has already signed up / signed in via Better Auth.
  // Verifies the authenticated user's email matches the invitation, then assigns the role.
  router.post("/user-invitations/:token/claim", async (req, res, next) => {
    try {
      const { token } = req.params as { token: string };
      const userId = req.actor.userId;
      if (!userId) throw forbidden("Login required");

      const invite = await db
        .select()
        .from(userInvitations)
        .where(eq(userInvitations.token, token))
        .then((rows) => rows[0] ?? null);

      if (!invite) throw notFound("Invitation not found");
      if (invite.revokedAt) throw badRequest("Invitation revoked");
      if (invite.acceptedAt) throw badRequest("Invitation already accepted");
      if (new Date(invite.expiresAt) < new Date()) throw badRequest("Invitation expired");

      // Verify the authenticated user's email matches
      const user = await db
        .select({ email: authUsers.email })
        .from(authUsers)
        .where(eq(authUsers.id, userId))
        .then((rows) => rows[0] ?? null);

      if (!user) throw forbidden("User not found");
      if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
        throw forbidden("Signed-in email does not match invitation email");
      }

      // Assign the role, stamp invitation
      const existing = await db
        .select({ id: userCompanyRoles.id })
        .from(userCompanyRoles)
        .where(
          and(
            eq(userCompanyRoles.userId, userId),
            eq(userCompanyRoles.companyId, invite.companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) {
        await db.insert(userCompanyRoles).values({
          userId,
          companyId: invite.companyId,
          role: invite.role,
        });
      } else {
        await db
          .update(userCompanyRoles)
          .set({ role: invite.role, updatedAt: new Date() })
          .where(eq(userCompanyRoles.id, existing.id));
      }

      await db
        .update(userInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(userInvitations.id, invite.id));

      res.json({ ok: true, companyId: invite.companyId, role: invite.role });
    } catch (err) {
      next(err);
    }
  });

  // DELETE /companies/:companyId/team/invitations/:invitationId
  // Revoke a pending invitation. Requires company_admin.
  router.delete(
    "/companies/:companyId/team/invitations/:invitationId",
    async (req, res, next) => {
      try {
        assertCompanyAccess(req, req.params.companyId!);
        const { companyId, invitationId } = req.params as {
          companyId: string;
          invitationId: string;
        };

        if (!isCompanyAdmin(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const [revoked] = await db
          .update(userInvitations)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(userInvitations.id, invitationId),
              eq(userInvitations.companyId, companyId),
              isNull(userInvitations.acceptedAt),
              isNull(userInvitations.revokedAt),
            ),
          )
          .returning();

        if (!revoked) throw notFound("Invitation not found or already resolved");

        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // GET /companies/:companyId/team/invitations
  // Lists pending invitations for a company. Requires company_admin.
  router.get("/companies/:companyId/team/invitations", async (req, res, next) => {
    try {
      assertCompanyAccess(req, req.params.companyId!);
      const { companyId } = req.params as { companyId: string };

      if (!isCompanyAdmin(req)) {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const invites = await db
        .select({
          id: userInvitations.id,
          email: userInvitations.email,
          role: userInvitations.role,
          expiresAt: userInvitations.expiresAt,
          createdAt: userInvitations.createdAt,
          token: userInvitations.token,
        })
        .from(userInvitations)
        .where(
          and(
            eq(userInvitations.companyId, companyId),
            isNull(userInvitations.acceptedAt),
            isNull(userInvitations.revokedAt),
          ),
        )
        .orderBy(userInvitations.createdAt);

      res.json({ invitations: invites });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 2: Typecheck the server**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter server exec tsc --noEmit 2>&1 | head -30`
Expected: No errors from `team.ts`

- [ ] **Step 3: Commit**

```bash
git add server/src/routes/team.ts
git commit -m "feat(server): team management routes (invite, list, role, revoke)"
```

---

## Task 6: Register team routes in app.ts

**Files:**
- Modify: `server/src/app.ts`

- [ ] **Step 1: Add the import**

In `server/src/app.ts`, add after the existing route imports (around line 36):

```typescript
import { teamRoutes } from "./routes/team.js";
```

- [ ] **Step 2: Register the routes**

In `server/src/app.ts`, inside the `api` router setup (look for where other routes are registered, around line 232 where `accessRoutes` is added):

```typescript
api.use(teamRoutes(db));
```

Add this line directly after `api.use(accessRoutes(...))` or before `api.use(agentRoutes(...))`.

- [ ] **Step 3: Typecheck and build**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm -r typecheck 2>&1 | tail -20`
Expected: All workspaces pass

- [ ] **Step 4: Commit**

```bash
git add server/src/app.ts
git commit -m "feat(server): register team routes in app"
```

---

## Task 7: UI API client — team.ts

**Files:**
- Create: `ui/src/api/team.ts`

- [ ] **Step 1: Write the API client**

```typescript
// ui/src/api/team.ts

export interface TeamMember {
  userId: string;
  role: string;
  createdAt: string;
  name: string | null;
  email: string | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  token: string;
}

export interface InviteDetails {
  email: string;
  role: string;
  companyName: string | null;
  expiresAt: string;
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export const teamApi = {
  listMembers: (companyId: string): Promise<{ members: TeamMember[] }> =>
    apiFetch(`/api/companies/${companyId}/team`),

  listInvitations: (companyId: string): Promise<{ invitations: PendingInvitation[] }> =>
    apiFetch(`/api/companies/${companyId}/team/invitations`),

  inviteUser: (
    companyId: string,
    email: string,
    role: string,
  ): Promise<{ invitation: PendingInvitation & { acceptLink: string } }> =>
    apiFetch(`/api/companies/${companyId}/team/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    }),

  updateRole: (
    companyId: string,
    userId: string,
    role: string,
  ): Promise<{ member: TeamMember }> =>
    apiFetch(`/api/companies/${companyId}/team/${userId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    }),

  removeMember: (companyId: string, userId: string): Promise<{ ok: boolean }> =>
    apiFetch(`/api/companies/${companyId}/team/${userId}`, { method: "DELETE" }),

  revokeInvitation: (companyId: string, invitationId: string): Promise<{ ok: boolean }> =>
    apiFetch(`/api/companies/${companyId}/team/invitations/${invitationId}`, {
      method: "DELETE",
    }),

  getInviteDetails: (token: string): Promise<{ invitation: InviteDetails }> =>
    apiFetch(`/api/user-invitations/${token}`),

  claimInvite: (
    token: string,
  ): Promise<{ ok: boolean; companyId: string; role: string }> =>
    apiFetch(`/api/user-invitations/${token}/claim`, { method: "POST" }),
};
```

- [ ] **Step 2: Typecheck UI**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter ui exec tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add ui/src/api/team.ts
git commit -m "feat(ui): team API client"
```

---

## Task 8: UI — Team Members settings page

**Files:**
- Create: `ui/src/pages/TeamMembers.tsx`
- Modify: `ui/src/pages/CompanySettings.tsx`

- [ ] **Step 1: Write TeamMembers.tsx**

```tsx
// ui/src/pages/TeamMembers.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { teamApi, type TeamMember, type PendingInvitation } from "../api/team";
import { Button } from "@/components/ui/button";
import { UserPlus, Trash2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLES = ["company_admin", "manager", "viewer"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
  company_admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export function TeamMembers() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["team-members", selectedCompanyId],
    queryFn: () => teamApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const invitationsQuery = useQuery({
    queryKey: ["team-invitations", selectedCompanyId],
    queryFn: () => teamApi.listInvitations(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) =>
      teamApi.inviteUser(selectedCompanyId!, email, role),
    onSuccess: (data) => {
      const link = `${window.location.origin}${data.invitation.acceptLink}`;
      setInviteLink(link);
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ["team-invitations", selectedCompanyId] });
      pushToast({ message: "Invitation created", type: "success" });
    },
    onError: (err: Error) => {
      pushToast({ message: err.message, type: "error" });
    },
  });

  const roleChangeMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      teamApi.updateRole(selectedCompanyId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", selectedCompanyId] });
      pushToast({ message: "Role updated", type: "success" });
    },
    onError: (err: Error) => {
      pushToast({ message: err.message, type: "error" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => teamApi.removeMember(selectedCompanyId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", selectedCompanyId] });
      pushToast({ message: "Member removed", type: "success" });
    },
    onError: (err: Error) => {
      pushToast({ message: err.message, type: "error" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (invitationId: string) =>
      teamApi.revokeInvitation(selectedCompanyId!, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-invitations", selectedCompanyId] });
      pushToast({ message: "Invitation revoked", type: "success" });
    },
    onError: (err: Error) => {
      pushToast({ message: err.message, type: "error" });
    },
  });

  function copyLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  const members: TeamMember[] = membersQuery.data?.members ?? [];
  const invitations: PendingInvitation[] = invitationsQuery.data?.invitations ?? [];

  return (
    <div className="space-y-8">
      {/* Invite section */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Invite team member</h3>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[90px] justify-between">
                {ROLE_LABELS[inviteRole]}
                <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ROLES.map((r) => (
                <DropdownMenuItem key={r} onClick={() => setInviteRole(r)}>
                  {ROLE_LABELS[r]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            size="sm"
            disabled={!inviteEmail || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate({ email: inviteEmail, role: inviteRole })}
          >
            <UserPlus className="h-4 w-4 mr-1" />
            Invite
          </Button>
        </div>

        {inviteLink && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
            <span className="flex-1 truncate text-xs font-mono text-muted-foreground">
              {inviteLink}
            </span>
            <Button size="sm" variant="ghost" onClick={copyLink}>
              {linkCopied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </div>

      {/* Current members */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Members</h3>
        {membersQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No members yet.</p>
        ) : (
          <div className="divide-y divide-border rounded-md border border-border">
            {members.map((m) => (
              <div key={m.userId} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name ?? m.email ?? m.userId}</p>
                  {m.email && m.name && (
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[90px] justify-between">
                      {ROLE_LABELS[m.role as Role] ?? m.role}
                      <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {ROLES.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        onClick={() => roleChangeMutation.mutate({ userId: m.userId, role: r })}
                      >
                        {ROLE_LABELS[r]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMutation.mutate(m.userId)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Pending invitations</h3>
          <div className="divide-y divide-border rounded-md border border-border">
            {invitations.map((inv) => (
              <div key={inv.id} className="flex items-center px-4 py-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{inv.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {ROLE_LABELS[inv.role as Role] ?? inv.role} · expires{" "}
                    {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const link = `${window.location.origin}/accept-user-invite/${inv.token}`;
                    navigator.clipboard.writeText(link);
                    pushToast({ message: "Link copied", type: "success" });
                  }}
                >
                  Copy link
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => revokeInviteMutation.mutate(inv.id)}
                  className="text-destructive hover:text-destructive"
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Team tab to CompanySettings.tsx**

In `ui/src/pages/CompanySettings.tsx`:

a) Add the import at the top of the file:
```typescript
import { TeamMembers } from "./TeamMembers";
```

b) Find the existing tab/section structure. CompanySettings uses a `activeTab` state or a simple tabbed layout. If it doesn't already have tabs, add a tab bar. Look for the `return (` statement and add a "Team" section.

The exact approach depends on how CompanySettings organizes its sections. Read the file to find the existing pattern, then add a "Team" tab that renders `<TeamMembers />`.

If CompanySettings uses a simple vertical section layout (not tabs), add:
```tsx
<section>
  <h2 className="text-base font-semibold mb-4">Team Members</h2>
  <TeamMembers />
</section>
```

If it uses a tab system, add a new "Team" tab following the existing pattern.

- [ ] **Step 3: Typecheck UI**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter ui exec tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add ui/src/pages/TeamMembers.tsx ui/src/pages/CompanySettings.tsx
git commit -m "feat(ui): Team Members settings tab with invite, role management, revoke"
```

---

## Task 9: UI — Accept User Invite page

**Files:**
- Create: `ui/src/pages/AcceptUserInvite.tsx`
- Modify: `ui/src/App.tsx`

This page handles the two-step accept flow:
1. Fetch invite details (email, role, company name)
2. Show Better Auth sign-up form (or sign-in if they have an account)
3. After auth, call `/api/user-invitations/:token/claim`
4. Redirect to company dashboard

- [ ] **Step 1: Write AcceptUserInvite.tsx**

```tsx
// ui/src/pages/AcceptUserInvite.tsx
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { teamApi, type InviteDetails } from "../api/team";
import { Button } from "@/components/ui/button";
import { authClient } from "../lib/auth-client";

const ROLE_LABELS: Record<string, string> = {
  company_admin: "Admin",
  manager: "Manager",
  viewer: "Viewer",
};

export function AcceptUserInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    teamApi
      .getInviteDetails(token)
      .then((data) => {
        setInvite(data.invitation);
        setEmail(data.invitation.email);
      })
      .catch((err: Error) => setFetchError(err.message));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          name,
          email,
          password,
        });
        if (result.error) throw new Error(result.error.message ?? "Sign up failed");
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error(result.error.message ?? "Sign in failed");
      }

      // Claim the invite now that we're authenticated
      const claim = await teamApi.claimInvite(token);
      navigate(`/${claim.companyId}/dashboard`);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-xl font-semibold">Invalid invitation</h1>
          <p className="text-muted-foreground text-sm">{fetchError}</p>
          <Button variant="outline" onClick={() => navigate("/")}>
            Go home
          </Button>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading invitation…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-semibold">
            You've been invited to {invite.companyName ?? "a company"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Join as <strong>{ROLE_LABELS[invite.role] ?? invite.role}</strong>
          </p>
        </div>

        <div className="flex border-b border-border">
          <button
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "signup"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setMode("signup")}
          >
            Create account
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              mode === "signin"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              readOnly={mode === "signup"}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : mode === "signup"
              ? "Create account & join"
              : "Sign in & join"}
          </Button>
        </form>
      </div>
    </div>
  );
}
```

Note: `authClient` is Better Auth's browser client. Check `ui/src/lib/auth-client.ts` (or wherever it's defined) for the correct import path. If it doesn't exist yet, look for how Better Auth is used in the existing `Auth.tsx` page and use the same pattern.

- [ ] **Step 2: Find the authClient import path**

Run: `grep -r "createAuthClient\|authClient\|better-auth" /home/ccasalicchio/paperclip-surfers/ui/src/ --include="*.ts" --include="*.tsx" -l`

Use the path from that result to fix the `import { authClient } from "../lib/auth-client"` import in `AcceptUserInvite.tsx`.

- [ ] **Step 3: Add route to App.tsx**

In `ui/src/App.tsx`:

Add import:
```typescript
import { AcceptUserInvitePage } from "./pages/AcceptUserInvite";
```

Add route (at the top-level, outside the company-scoped layout, near the existing `invite/:token` route):
```tsx
<Route path="accept-user-invite/:token" element={<AcceptUserInvitePage />} />
```

- [ ] **Step 4: Typecheck UI**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter ui exec tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add ui/src/pages/AcceptUserInvite.tsx ui/src/App.tsx
git commit -m "feat(ui): accept-user-invite page with sign-up / sign-in flow and claim"
```

---

## Task 10: First-user Super Admin promotion

**Files:**
- Modify: `server/src/auth/better-auth.ts`

When the first user signs up, they become instance_admin (the Super Admin equivalent). This uses Better Auth's `onAfterSuccess` or database hooks.

- [ ] **Step 1: Find the Better Auth hook location**

Run: `grep -n "onAfterSuccess\|hooks\|after.*sign\|database.hooks" /home/ccasalicchio/paperclip-surfers/server/src/auth/better-auth.ts | head -20`

- [ ] **Step 2: Read the relevant portion of better-auth.ts**

Run: `head -80 /home/ccasalicchio/paperclip-surfers/server/src/auth/better-auth.ts`

Identify where to insert the post-signup hook. Better Auth's `emailAndPassword` plugin supports `onEmailVerification` and the `betterAuth()` call supports `hooks.after`.

- [ ] **Step 3: Add the first-user promotion hook**

In `server/src/auth/better-auth.ts`, within the `betterAuth({ ... })` call, add a `hooks` section (or extend the existing one):

```typescript
hooks: {
  after: [
    {
      matcher(context) {
        return context.path === "/sign-up/email";
      },
      async handler(context) {
        try {
          const body = context.body as { email?: string } | undefined;
          const email = body?.email;
          if (!email) return;

          // Find the newly created user
          const user = await db
            .select({ id: authUsers.id, email: authUsers.email })
            .from(authUsers)
            .where(eq(authUsers.email, email.toLowerCase()))
            .then((rows) => rows[0] ?? null);

          if (!user) return;

          // Check if this is the first user OR matches PAPERCLIP_SUPER_ADMIN_EMAIL
          const totalUsers = await db
            .select({ id: authUsers.id })
            .from(authUsers)
            .then((rows) => rows.length);

          const superAdminEmail = process.env.PAPERCLIP_SUPER_ADMIN_EMAIL;
          const shouldPromote =
            totalUsers === 1 ||
            (superAdminEmail && user.email.toLowerCase() === superAdminEmail.toLowerCase());

          if (!shouldPromote) return;

          const existing = await db
            .select({ id: instanceUserRoles.id })
            .from(instanceUserRoles)
            .where(
              and(
                eq(instanceUserRoles.userId, user.id),
                eq(instanceUserRoles.role, "instance_admin"),
              ),
            )
            .then((rows) => rows[0] ?? null);

          if (!existing) {
            await db.insert(instanceUserRoles).values({
              userId: user.id,
              role: "instance_admin",
            });
          }
        } catch {
          // Non-fatal — if promotion fails, admin can manually elevate
        }
      },
    },
  ],
},
```

Ensure the required imports (`authUsers`, `instanceUserRoles`, `and`, `eq`) are present at the top of `better-auth.ts`.

- [ ] **Step 4: Typecheck server**

Run: `cd /home/ccasalicchio/paperclip-surfers && pnpm --filter server exec tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add server/src/auth/better-auth.ts
git commit -m "feat(server): auto-promote first registered user to instance_admin"
```

---

## Task 11: Full verification pass

- [ ] **Step 1: Run full typecheck**

```bash
cd /home/ccasalicchio/paperclip-surfers && pnpm -r typecheck 2>&1 | tail -30
```

Expected: All workspaces report 0 errors.

- [ ] **Step 2: Run tests**

```bash
cd /home/ccasalicchio/paperclip-surfers && pnpm test:run 2>&1 | tail -30
```

Expected: All suites pass (no regressions).

- [ ] **Step 3: Run build**

```bash
cd /home/ccasalicchio/paperclip-surfers && pnpm build 2>&1 | tail -20
```

Expected: Build succeeds for all packages.

- [ ] **Step 4: Manual smoke test (dev server)**

Start dev server: `pnpm dev`

Test these flows in the browser at `http://localhost:3100`:
1. Go to Company Settings → verify "Team Members" section/tab is visible
2. Enter an email and role, click Invite → invite link appears
3. Open the invite link in a new tab → Accept Invite page loads with company name and role shown
4. Fill in name + password and submit → redirected to dashboard
5. Back in Team Members, the new user appears in the list

- [ ] **Step 5: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: Foundation Layer 1 cleanup and verification"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `user_company_roles` table — Tasks 1–3
- ✅ `user_invitations` table — Tasks 2–3
- ✅ Role hierarchy (viewer < manager < company_admin < super_admin) — Task 4 + `requireCompanyAdminRole`
- ✅ Invite by email + role — Task 5 (server) + Task 7 (UI)
- ✅ Accept invite page — Task 9
- ✅ Auto-login after accept — Task 9 (via Better Auth signUp/signIn + claim)
- ✅ First user → instance_admin — Task 10
- ✅ `PAPERCLIP_SUPER_ADMIN_EMAIL` env var — Task 10
- ✅ Settings → Team Members UI — Task 8
- ✅ Change role, revoke access — Tasks 5 + 8
- ✅ Pending invitations list — Tasks 5 + 8

**Placeholder scan:** No TBDs, TODOs, or "implement later" phrases in the above.

**Type consistency:**
- `userCompanyRoles` used consistently in server routes and DB schema
- `userInvitations` used consistently
- `TeamMember`, `PendingInvitation`, `InviteDetails` defined in `ui/src/api/team.ts` and used in `TeamMembers.tsx` and `AcceptUserInvite.tsx`
- `COMPANY_USER_ROLES` and `CompanyUserRole` from constants.ts used in validators
