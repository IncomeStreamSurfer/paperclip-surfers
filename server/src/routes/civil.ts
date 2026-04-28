import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  civilProjects as civilProjectsTable,
  civilDrawings as civilDrawingsTable,
  civilSpecifications as civilSpecsTable,
} from "@paperclipai/db";
import {
  createCivilProjectSchema,
  updateCivilProjectSchema,
  createCivilDrawingSchema,
  updateCivilDrawingSchema,
  createCivilSpecificationSchema,
  updateCivilSpecificationSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { notFound } from "../errors.js";

export function civilRoutes(db: Db) {
  const router = Router();

  /* ── Civil Projects ── */

  router.get("/companies/:companyId/civil/projects", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(civilProjectsTable)
        .where(eq(civilProjectsTable.companyId, companyId))
        .orderBy(civilProjectsTable.name);
      res.json({ projects: rows });
    } catch (err) { next(err); }
  });

  router.get("/companies/:companyId/civil/projects/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const row = await db
        .select()
        .from(civilProjectsTable)
        .where(and(eq(civilProjectsTable.id, id), eq(civilProjectsTable.companyId, companyId)))
        .then((r) => r[0] ?? null);
      if (!row) throw notFound("Civil project not found");
      res.json(row);
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/civil/projects",
    validate(createCivilProjectSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as Record<string, unknown>;
        const vals: Record<string, unknown> = { companyId, ...body };
        if (typeof vals.startDate === "string") vals.startDate = new Date(vals.startDate as string);
        if (typeof vals.endDate === "string") vals.endDate = new Date(vals.endDate as string);
        const [created] = await db.insert(civilProjectsTable).values(vals as never).returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/civil/projects/:id",
    validate(updateCivilProjectSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const body = { ...(req.body as Record<string, unknown>), updatedAt: new Date() } as Record<string, unknown>;
        if (typeof body.startDate === "string") body.startDate = new Date(body.startDate as string);
        if (typeof body.endDate === "string") body.endDate = new Date(body.endDate as string);
        const [updated] = await db
          .update(civilProjectsTable)
          .set(body)
          .where(and(eq(civilProjectsTable.id, id), eq(civilProjectsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Civil project not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/civil/projects/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(civilProjectsTable)
        .where(and(eq(civilProjectsTable.id, id), eq(civilProjectsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Civil project not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  /* ── Civil Drawings ── */

  router.get("/companies/:companyId/civil/drawings", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const projectId = req.query.projectId as string | undefined;
      const rows = await db
        .select()
        .from(civilDrawingsTable)
        .where(
          projectId
            ? and(eq(civilDrawingsTable.companyId, companyId), eq(civilDrawingsTable.projectId, projectId))
            : eq(civilDrawingsTable.companyId, companyId),
        )
        .orderBy(desc(civilDrawingsTable.createdAt));
      res.json({ drawings: rows });
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/civil/drawings",
    validate(createCivilDrawingSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(civilDrawingsTable)
          .values({ companyId, ...req.body as Record<string, unknown> } as never)
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/civil/drawings/:id",
    validate(updateCivilDrawingSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const [updated] = await db
          .update(civilDrawingsTable)
          .set({ ...req.body as Record<string, unknown>, updatedAt: new Date() })
          .where(and(eq(civilDrawingsTable.id, id), eq(civilDrawingsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Drawing not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/civil/drawings/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(civilDrawingsTable)
        .where(and(eq(civilDrawingsTable.id, id), eq(civilDrawingsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Drawing not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  /* ── Civil Specifications ── */

  router.get("/companies/:companyId/civil/specs", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const projectId = req.query.projectId as string | undefined;
      const rows = await db
        .select()
        .from(civilSpecsTable)
        .where(
          projectId
            ? and(eq(civilSpecsTable.companyId, companyId), eq(civilSpecsTable.projectId, projectId))
            : eq(civilSpecsTable.companyId, companyId),
        )
        .orderBy(civilSpecsTable.sectionNumber);
      res.json({ specs: rows });
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/civil/specs",
    validate(createCivilSpecificationSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(civilSpecsTable)
          .values({ companyId, ...req.body as Record<string, unknown> } as never)
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/civil/specs/:id",
    validate(updateCivilSpecificationSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const [updated] = await db
          .update(civilSpecsTable)
          .set({ ...req.body as Record<string, unknown>, updatedAt: new Date() })
          .where(and(eq(civilSpecsTable.id, id), eq(civilSpecsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Specification not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/civil/specs/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(civilSpecsTable)
        .where(and(eq(civilSpecsTable.id, id), eq(civilSpecsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Specification not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  return router;
}
