import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Db } from "@paperclipai/db";
import {
  agents as agentsTable,
  departments as departmentsTable,
  agentDepartments as agentDepartmentsTable,
  userCompanyRoles,
} from "@paperclipai/db";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  addDepartmentMemorySchema,
  assignAgentToDepartmentSchema,
  COMPANY_USER_ROLE_HIERARCHY,
  type CreateDepartment,
  type UpdateDepartment,
  type AddDepartmentMemory,
  type AssignAgentToDepartment,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { logActivity } from "../services/index.js";
import { notFound, forbidden } from "../errors.js";

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

function isInstanceAdminActor(req: { actor: { isInstanceAdmin?: boolean; source?: string } }) {
  return req.actor.isInstanceAdmin || req.actor.source === "local_implicit";
}

export function departmentRoutes(db: Db) {
  const router = Router();

  // List departments (with optional agent membership)
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

      // Batch-load all agent memberships for this company in one query
      const allMemberships = await db
        .select({
          departmentId: agentDepartmentsTable.departmentId,
          agentId: agentDepartmentsTable.agentId,
          name: agentsTable.name,
          status: agentsTable.status,
        })
        .from(agentDepartmentsTable)
        .innerJoin(agentsTable, eq(agentsTable.id, agentDepartmentsTable.agentId))
        .where(eq(agentsTable.companyId, companyId));

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

  // Get single department with agents
  router.get("/companies/:companyId/departments/:departmentId", async (req, res, next) => {
    try {
      const { companyId, departmentId } = req.params as {
        companyId: string;
        departmentId: string;
      };
      assertCompanyAccess(req, companyId);

      const dept = await db
        .select()
        .from(departmentsTable)
        .where(
          and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)),
        )
        .then((rows) => rows[0] ?? null);

      if (!dept) throw notFound("Department not found");

      const members = await db
        .select({
          agentId: agentDepartmentsTable.agentId,
          name: agentsTable.name,
          status: agentsTable.status,
        })
        .from(agentDepartmentsTable)
        .innerJoin(agentsTable, eq(agentsTable.id, agentDepartmentsTable.agentId))
        .where(eq(agentDepartmentsTable.departmentId, departmentId));

      res.json({ ...dept, agents: members });
    } catch (err) {
      next(err);
    }
  });

  // Create department
  router.post(
    "/companies/:companyId/departments",
    validate(createDepartmentSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const body = req.body as CreateDepartment;
        const [created] = await db
          .insert(departmentsTable)
          .values({ companyId, ...body })
          .returning();

        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: req.actor.userId ?? "board",
          action: "department.created",
          entityType: "department",
          entityId: created.id,
          details: { name: created.name },
        });

        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  // Update department
  router.patch(
    "/companies/:companyId/departments/:departmentId",
    validate(updateDepartmentSchema),
    async (req, res, next) => {
      try {
        const { companyId, departmentId } = req.params as {
          companyId: string;
          departmentId: string;
        };
        assertCompanyAccess(req, companyId);
        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const body = req.body as UpdateDepartment;
        const [updated] = await db
          .update(departmentsTable)
          .set({ ...body, updatedAt: new Date() })
          .where(
            and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)),
          )
          .returning();

        if (!updated) throw notFound("Department not found");

        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: req.actor.userId ?? "board",
          action: "department.updated",
          entityType: "department",
          entityId: departmentId,
          details: body,
        });

        res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  // Delete department
  router.delete("/companies/:companyId/departments/:departmentId", async (req, res, next) => {
    try {
      const { companyId, departmentId } = req.params as {
        companyId: string;
        departmentId: string;
      };
      assertCompanyAccess(req, companyId);
      if (!isInstanceAdminActor(req)) {
        await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
      }

      const [deleted] = await db
        .delete(departmentsTable)
        .where(
          and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)),
        )
        .returning();

      if (!deleted) throw notFound("Department not found");

      await logActivity(db, {
        companyId,
        actorType: "user",
        actorId: req.actor.userId ?? "board",
        action: "department.deleted",
        entityType: "department",
        entityId: departmentId,
        details: { name: deleted.name },
      });

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  // Add agent to department
  router.post(
    "/companies/:companyId/departments/:departmentId/agents",
    validate(assignAgentToDepartmentSchema),
    async (req, res, next) => {
      try {
        const { companyId, departmentId } = req.params as {
          companyId: string;
          departmentId: string;
        };
        assertCompanyAccess(req, companyId);
        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const { agentId } = req.body as AssignAgentToDepartment;

        // Verify department belongs to this company
        const dept = await db
          .select({ id: departmentsTable.id })
          .from(departmentsTable)
          .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
          .then((rows) => rows[0] ?? null);
        if (!dept) throw notFound("Department not found");

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
          actorType: "user",
          actorId: req.actor.userId ?? "board",
          action: "department.agent_added",
          entityType: "department",
          entityId: departmentId,
          details: { agentId },
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  // Remove agent from department
  router.delete(
    "/companies/:companyId/departments/:departmentId/agents/:agentId",
    async (req, res, next) => {
      try {
        const { companyId, departmentId, agentId } = req.params as {
          companyId: string;
          departmentId: string;
          agentId: string;
        };
        assertCompanyAccess(req, companyId);
        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        // Verify department belongs to this company
        const dept = await db
          .select({ id: departmentsTable.id })
          .from(departmentsTable)
          .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
          .then((rows) => rows[0] ?? null);
        if (!dept) throw notFound("Department not found");

        const deleted = await db
          .delete(agentDepartmentsTable)
          .where(
            and(
              eq(agentDepartmentsTable.departmentId, departmentId),
              eq(agentDepartmentsTable.agentId, agentId),
            ),
          )
          .returning();

        if (!deleted.length) throw notFound("Agent is not a member of this department");

        await logActivity(db, {
          companyId,
          actorType: "user",
          actorId: req.actor.userId ?? "board",
          action: "department.agent_removed",
          entityType: "department",
          entityId: departmentId,
          details: { agentId },
        });

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  // Add memory entry to department
  router.post(
    "/companies/:companyId/departments/:departmentId/memory",
    validate(addDepartmentMemorySchema),
    async (req, res, next) => {
      try {
        const { companyId, departmentId } = req.params as {
          companyId: string;
          departmentId: string;
        };
        assertCompanyAccess(req, companyId);
        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const dept = await db
          .select()
          .from(departmentsTable)
          .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
          .then((rows) => rows[0] ?? null);
        if (!dept) throw notFound("Department not found");

        const { content } = req.body as AddDepartmentMemory;
        const existing = (dept.memory ?? []) as Array<{ id: string; content: string; createdAt: string }>;
        const newEntry = { id: randomUUID(), content, createdAt: new Date().toISOString() };
        const updated = await db
          .update(departmentsTable)
          .set({ memory: [...existing, newEntry], updatedAt: new Date() })
          .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
          .returning()
          .then((rows) => rows[0] ?? null);

        if (!updated) throw notFound("Department not found");
        res.status(201).json(newEntry);
      } catch (err) {
        next(err);
      }
    },
  );

  // Remove memory entry from department
  router.delete(
    "/companies/:companyId/departments/:departmentId/memory/:entryId",
    async (req, res, next) => {
      try {
        const { companyId, departmentId, entryId } = req.params as {
          companyId: string;
          departmentId: string;
          entryId: string;
        };
        assertCompanyAccess(req, companyId);
        if (!isInstanceAdminActor(req)) {
          await requireCompanyAdminRole(db, companyId, req.actor.userId ?? null);
        }

        const dept = await db
          .select()
          .from(departmentsTable)
          .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)))
          .then((rows) => rows[0] ?? null);
        if (!dept) throw notFound("Department not found");

        const existing = (dept.memory ?? []) as Array<{ id: string; content: string; createdAt: string }>;
        const filtered = existing.filter((e) => e.id !== entryId);
        if (filtered.length === existing.length) throw notFound("Memory entry not found");

        await db
          .update(departmentsTable)
          .set({ memory: filtered, updatedAt: new Date() })
          .where(and(eq(departmentsTable.id, departmentId), eq(departmentsTable.companyId, companyId)));

        res.status(204).send();
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
