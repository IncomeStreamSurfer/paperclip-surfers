import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createCopywritingBriefSchema,
  updateCopywritingBriefSchema,
  type UpdateCopywritingBrief,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { copywritingService } from "../services/copywriting.js";
import { logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function copywritingRoutes(db: Db) {
  const router = Router();
  const svc = copywritingService(db);

  // List briefs for a company
  router.get("/companies/:companyId/copywriting/briefs", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { status, contentType } = req.query as { status?: string; contentType?: string };
    const briefs = await svc.listBriefs(companyId, { status, contentType });
    res.json(briefs);
  });

  // Get a single brief
  router.get("/copywriting/briefs/:briefId", async (req, res) => {
    const { briefId } = req.params as { briefId: string };
    const brief = await svc.getBriefById(briefId);
    if (!brief) { res.status(404).json({ error: "Brief not found" }); return; }
    assertCompanyAccess(req, brief.companyId);
    res.json(brief);
  });

  // Create a brief
  router.post(
    "/companies/:companyId/copywriting/briefs",
    validate(createCopywritingBriefSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const brief = await svc.createBrief(
        companyId,
        req.body as Parameters<typeof svc.createBrief>[1],
      );
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "copywriting_brief.created",
        entityType: "copywriting_brief",
        entityId: brief!.id,
        details: { title: brief!.title, contentType: brief!.contentType },
      });
      res.status(201).json(brief);
    },
  );

  // Update a brief
  router.patch(
    "/copywriting/briefs/:briefId",
    validate(updateCopywritingBriefSchema),
    async (req, res) => {
      const { briefId } = req.params as { briefId: string };
      const existing = await svc.getBriefById(briefId);
      if (!existing) { res.status(404).json({ error: "Brief not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const brief = await svc.updateBrief(
        briefId,
        req.body as Parameters<typeof svc.updateBrief>[1],
      );
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "copywriting_brief.updated",
        entityType: "copywriting_brief",
        entityId: briefId,
        details: {
          title: existing.title,
          newStatus: (req.body as { status?: string }).status,
        },
      });
      res.json(brief);
    },
  );

  // Delete a brief
  router.delete("/copywriting/briefs/:briefId", async (req, res) => {
    const { briefId } = req.params as { briefId: string };
    const existing = await svc.getBriefById(briefId);
    if (!existing) { res.status(404).json({ error: "Brief not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deleteBrief(briefId);
    res.status(204).send();
  });

  // Generate content for a brief via Ollama
  router.post("/copywriting/briefs/:briefId/generate", async (req, res) => {
    const { briefId } = req.params as { briefId: string };
    const existing = await svc.getBriefById(briefId);
    if (!existing) { res.status(404).json({ error: "Brief not found" }); return; }
    assertCompanyAccess(req, existing.companyId);

    // Mark in-progress before the (slow) Ollama call
    await svc.updateBrief(briefId, { status: "in-progress" });

    let content: string;
    let wordCount: number;
    try {
      ({ content, wordCount } = await svc.generateBriefContent(
        existing as Parameters<typeof svc.generateBriefContent>[0],
      ));
    } catch (err) {
      // Revert status on failure
      await svc.updateBrief(briefId, { status: existing.status as UpdateCopywritingBrief["status"] });
      throw err;
    }

    const updated = await svc.updateBrief(briefId, {
      generatedContent: content,
      generatedWordCount: wordCount,
      status: "review",
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: existing.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "copywriting_brief.generated",
      entityType: "copywriting_brief",
      entityId: briefId,
      details: { title: existing.title, wordCount },
    });

    res.json(updated);
  });

  return router;
}
