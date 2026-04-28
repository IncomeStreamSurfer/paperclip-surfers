import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createSeoKeywordSchema,
  updateSeoKeywordSchema,
  createSeoPageSchema,
  updateSeoPageSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { seoService } from "../services/seo.js";
import { logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function seoRoutes(db: Db) {
  const router = Router();
  const svc = seoService(db);

  // ---- Keywords ----

  router.get("/companies/:companyId/seo/keywords", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const keywords = await svc.listKeywords(companyId);
    res.json(keywords);
  });

  router.post(
    "/companies/:companyId/seo/keywords",
    validate(createSeoKeywordSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const keyword = await svc.createKeyword(companyId, req.body as Parameters<typeof svc.createKeyword>[1]);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "seo_keyword.created",
        entityType: "seo_keyword",
        entityId: keyword!.id,
        details: { keyword: keyword!.keyword },
      });
      res.status(201).json(keyword);
    },
  );

  router.patch(
    "/seo/keywords/:keywordId",
    validate(updateSeoKeywordSchema),
    async (req, res) => {
      const { keywordId } = req.params as { keywordId: string };
      const existing = await svc.getKeywordById(keywordId);
      if (!existing) { res.status(404).json({ error: "Keyword not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const keyword = await svc.updateKeyword(keywordId, req.body as Parameters<typeof svc.updateKeyword>[1]);
      res.json(keyword);
    },
  );

  router.delete("/seo/keywords/:keywordId", async (req, res) => {
    const { keywordId } = req.params as { keywordId: string };
    const existing = await svc.getKeywordById(keywordId);
    if (!existing) { res.status(404).json({ error: "Keyword not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deleteKeyword(keywordId);
    res.status(204).send();
  });

  // ---- Pages ----

  router.get("/companies/:companyId/seo/pages", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { status } = req.query as { status?: string };
    const pages = await svc.listPages(companyId, { status });
    res.json(pages);
  });

  router.get("/seo/pages/:pageId", async (req, res) => {
    const { pageId } = req.params as { pageId: string };
    const page = await svc.getPageById(pageId);
    if (!page) { res.status(404).json({ error: "SEO page not found" }); return; }
    assertCompanyAccess(req, page.companyId);
    res.json(page);
  });

  router.post(
    "/companies/:companyId/seo/pages",
    validate(createSeoPageSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const page = await svc.createPage(companyId, req.body as Parameters<typeof svc.createPage>[1]);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "seo_page.created",
        entityType: "seo_page",
        entityId: page!.id,
        details: { url: page!.url, status: page!.status },
      });
      res.status(201).json(page);
    },
  );

  router.patch(
    "/seo/pages/:pageId",
    validate(updateSeoPageSchema),
    async (req, res) => {
      const { pageId } = req.params as { pageId: string };
      const existing = await svc.getPageById(pageId);
      if (!existing) { res.status(404).json({ error: "SEO page not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const page = await svc.updatePage(pageId, req.body as Parameters<typeof svc.updatePage>[1]);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "seo_page.updated",
        entityType: "seo_page",
        entityId: pageId,
        details: { url: existing.url, newStatus: (req.body as { status?: string }).status },
      });
      res.json(page);
    },
  );

  router.delete("/seo/pages/:pageId", async (req, res) => {
    const { pageId } = req.params as { pageId: string };
    const existing = await svc.getPageById(pageId);
    if (!existing) { res.status(404).json({ error: "SEO page not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deletePage(pageId);
    res.status(204).send();
  });

  return router;
}
