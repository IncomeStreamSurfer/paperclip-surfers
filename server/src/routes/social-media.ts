import { Router } from "express";
import type { Db } from "@paperclipai/db";
import {
  createSocialAccountSchema,
  updateSocialAccountSchema,
  createSocialPostSchema,
  updateSocialPostSchema,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { socialMediaService } from "../services/social-media.js";
import { logActivity } from "../services/index.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

export function socialMediaRoutes(db: Db) {
  const router = Router();
  const svc = socialMediaService(db);

  // ---- Accounts ----

  router.get("/companies/:companyId/social-media/accounts", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const accounts = await svc.listAccounts(companyId);
    res.json(accounts);
  });

  router.post(
    "/companies/:companyId/social-media/accounts",
    validate(createSocialAccountSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const account = await svc.createAccount(companyId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "social_account.created",
        entityType: "social_account",
        entityId: account.id,
        details: { platform: account.platform, handle: account.handle },
      });
      res.status(201).json(account);
    },
  );

  router.patch(
    "/social-media/accounts/:accountId",
    validate(updateSocialAccountSchema),
    async (req, res) => {
      const { accountId } = req.params as { accountId: string };
      const existing = await svc.getAccountById(accountId);
      if (!existing) { res.status(404).json({ error: "Account not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const account = await svc.updateAccount(accountId, req.body);
      res.json(account);
    },
  );

  router.delete("/social-media/accounts/:accountId", async (req, res) => {
    const { accountId } = req.params as { accountId: string };
    const existing = await svc.getAccountById(accountId);
    if (!existing) { res.status(404).json({ error: "Account not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deleteAccount(accountId);
    res.status(204).send();
  });

  // ---- Posts ----

  router.get("/companies/:companyId/social-media/posts", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const { status, accountId } = req.query as { status?: string; accountId?: string };
    const posts = await svc.listPosts(companyId, { status, accountId });
    res.json(posts);
  });

  router.get("/social-media/posts/:postId", async (req, res) => {
    const { postId } = req.params as { postId: string };
    const post = await svc.getPostById(postId);
    if (!post) { res.status(404).json({ error: "Post not found" }); return; }
    assertCompanyAccess(req, post.companyId);
    res.json(post);
  });

  router.post(
    "/companies/:companyId/social-media/posts",
    validate(createSocialPostSchema),
    async (req, res) => {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const actor = getActorInfo(req);
      const post = await svc.createPost(companyId, req.body, actor.actorId ?? undefined);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "social_post.created",
        entityType: "social_post",
        entityId: post.id,
        details: { title: post.title, status: post.status },
      });
      res.status(201).json(post);
    },
  );

  router.patch(
    "/social-media/posts/:postId",
    validate(updateSocialPostSchema),
    async (req, res) => {
      const { postId } = req.params as { postId: string };
      const existing = await svc.getPostById(postId);
      if (!existing) { res.status(404).json({ error: "Post not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const post = await svc.updatePost(postId, req.body);
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: existing.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "social_post.updated",
        entityType: "social_post",
        entityId: postId,
        details: { title: existing.title, newStatus: (req.body as { status?: string }).status },
      });
      res.json(post);
    },
  );

  router.delete("/social-media/posts/:postId", async (req, res) => {
    const { postId } = req.params as { postId: string };
    const existing = await svc.getPostById(postId);
    if (!existing) { res.status(404).json({ error: "Post not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.deletePost(postId);
    res.status(204).send();
  });

  return router;
}
