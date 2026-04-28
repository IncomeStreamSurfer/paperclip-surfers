import { Router } from "express";
import { and, eq, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  researchProjects as researchProjectsTable,
  researchNotes as researchNotesTable,
  researchLiterature as researchLiteratureTable,
} from "@paperclipai/db";
import {
  createResearchProjectSchema,
  updateResearchProjectSchema,
  createResearchNoteSchema,
  updateResearchNoteSchema,
  createResearchLiteratureSchema,
  updateResearchLiteratureSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import { notFound } from "../errors.js";

export function researchRoutes(db: Db) {
  const router = Router();

  /* ── Research Projects ── */

  router.get("/companies/:companyId/research/projects", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(researchProjectsTable)
        .where(eq(researchProjectsTable.companyId, companyId))
        .orderBy(desc(researchProjectsTable.createdAt));
      res.json({ projects: rows });
    } catch (err) { next(err); }
  });

  router.get("/companies/:companyId/research/projects/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const row = await db
        .select()
        .from(researchProjectsTable)
        .where(and(eq(researchProjectsTable.id, id), eq(researchProjectsTable.companyId, companyId)))
        .then((rows) => rows[0] ?? null);
      if (!row) throw notFound("Research project not found");
      res.json(row);
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/research/projects",
    validate(createResearchProjectSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(researchProjectsTable)
          .values({ companyId, ...req.body })
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/research/projects/:id",
    validate(updateResearchProjectSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const [updated] = await db
          .update(researchProjectsTable)
          .set({ ...req.body, updatedAt: new Date() })
          .where(and(eq(researchProjectsTable.id, id), eq(researchProjectsTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Research project not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/research/projects/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(researchProjectsTable)
        .where(and(eq(researchProjectsTable.id, id), eq(researchProjectsTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Research project not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  /* ── Research Notes ── */

  router.get("/companies/:companyId/research/notes", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const projectId = req.query.projectId as string | undefined;
      const rows = await db
        .select()
        .from(researchNotesTable)
        .where(
          projectId
            ? and(eq(researchNotesTable.companyId, companyId), eq(researchNotesTable.projectId, projectId))
            : eq(researchNotesTable.companyId, companyId),
        )
        .orderBy(desc(researchNotesTable.createdAt));
      res.json({ notes: rows });
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/research/notes",
    validate(createResearchNoteSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(researchNotesTable)
          .values({ companyId, ...req.body })
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/research/notes/:id",
    validate(updateResearchNoteSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const [updated] = await db
          .update(researchNotesTable)
          .set({ ...req.body, updatedAt: new Date() })
          .where(and(eq(researchNotesTable.id, id), eq(researchNotesTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Research note not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/research/notes/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(researchNotesTable)
        .where(and(eq(researchNotesTable.id, id), eq(researchNotesTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Research note not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  /* ── Research Literature ── */

  router.get("/companies/:companyId/research/literature", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const projectId = req.query.projectId as string | undefined;
      const rows = await db
        .select()
        .from(researchLiteratureTable)
        .where(
          projectId
            ? and(eq(researchLiteratureTable.companyId, companyId), eq(researchLiteratureTable.projectId, projectId))
            : eq(researchLiteratureTable.companyId, companyId),
        )
        .orderBy(desc(researchLiteratureTable.createdAt));
      res.json({ literature: rows });
    } catch (err) { next(err); }
  });

  router.post(
    "/companies/:companyId/research/literature",
    validate(createResearchLiteratureSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const [created] = await db
          .insert(researchLiteratureTable)
          .values({ companyId, ...req.body })
          .returning();
        res.status(201).json(created);
      } catch (err) { next(err); }
    },
  );

  router.patch(
    "/companies/:companyId/research/literature/:id",
    validate(updateResearchLiteratureSchema),
    async (req, res, next) => {
      try {
        const { companyId, id } = req.params as { companyId: string; id: string };
        assertCompanyAccess(req, companyId);
        const [updated] = await db
          .update(researchLiteratureTable)
          .set({ ...req.body, updatedAt: new Date() })
          .where(and(eq(researchLiteratureTable.id, id), eq(researchLiteratureTable.companyId, companyId)))
          .returning();
        if (!updated) throw notFound("Literature entry not found");
        res.json(updated);
      } catch (err) { next(err); }
    },
  );

  router.delete("/companies/:companyId/research/literature/:id", async (req, res, next) => {
    try {
      const { companyId, id } = req.params as { companyId: string; id: string };
      assertCompanyAccess(req, companyId);
      const [deleted] = await db
        .delete(researchLiteratureTable)
        .where(and(eq(researchLiteratureTable.id, id), eq(researchLiteratureTable.companyId, companyId)))
        .returning();
      if (!deleted) throw notFound("Literature entry not found");
      res.status(204).send();
    } catch (err) { next(err); }
  });

  return router;
}
