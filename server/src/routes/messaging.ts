import { Router } from "express";
import { randomBytes } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { messagingProviders, messagingSubscriptions } from "@paperclipai/db";
import {
  upsertMessagingProviderSchema,
  upsertMessagingSubscriptionSchema,
} from "@paperclipai/shared";
import { eq, and } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";

function generateWebhookSecret(): string {
  return require("node:crypto").randomBytes(32).toString("hex");
}

function generateWebhookToken(): string {
  return require("node:crypto").randomBytes(16).toString("hex");
}

export function messagingRoutes(db: Db) {
  const router = Router();

  // ── Providers ────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/messaging/providers", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(messagingProviders)
        .where(eq(messagingProviders.companyId, companyId));
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/companies/:companyId/messaging/providers",
    validate(upsertMessagingProviderSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as unknown as { provider: string; enabled: boolean; config: Record<string, unknown> };
        const { provider, enabled, config } = body;
        const now = new Date();

        const existing = await db
          .select()
          .from(messagingProviders)
          .where(
            and(
              eq(messagingProviders.companyId, companyId),
              eq(messagingProviders.provider, provider),
            ),
          )
          .then((rows) => rows[0] ?? null);

        let finalConfig = config;
        if (provider === "telegram") {
          const existingSecret = (existing?.config as Record<string, unknown> | undefined)?.webhookSecret as string | undefined;
          const incomingSecret = config.webhookSecret as string | undefined;
          const existingToken = (existing?.config as Record<string, unknown> | undefined)?.webhookToken as string | undefined;
          finalConfig = {
            ...config,
            webhookSecret: incomingSecret || existingSecret || generateWebhookSecret(),
            webhookToken: existingToken || generateWebhookToken(),
          };
        }

        if (existing) {
          const [updated] = await db
            .update(messagingProviders)
            .set({ enabled, config: finalConfig, updatedAt: now })
            .where(eq(messagingProviders.id, existing.id))
            .returning();
          res.json(updated);
        } else {
          const [created] = await db
            .insert(messagingProviders)
            .values({
              companyId,
              provider,
              enabled,
              config: finalConfig,
              createdAt: now,
              updatedAt: now,
            } as never)
            .returning();
          res.status(201).json(created);
        }
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete("/companies/:companyId/messaging/providers/:provider", async (req, res, next) => {
    try {
      const { companyId, provider } = req.params as { companyId: string; provider: string };
      assertCompanyAccess(req, companyId);
      await db
        .delete(messagingProviders)
        .where(
          and(
            eq(messagingProviders.companyId, companyId),
            eq(messagingProviders.provider, provider),
          ),
        );
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Subscriptions ────────────────────────────────────────────────────────

  router.get("/companies/:companyId/messaging/subscriptions", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(messagingSubscriptions)
        .where(eq(messagingSubscriptions.companyId, companyId));
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.put(
    "/companies/:companyId/messaging/subscriptions",
    validate(upsertMessagingSubscriptionSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as unknown as { provider: string; messageType: string; enabled: boolean; includeImage: boolean };
        const { provider, messageType, enabled, includeImage } = body;
        const now = new Date();

        const existing = await db
          .select()
          .from(messagingSubscriptions)
          .where(
            and(
              eq(messagingSubscriptions.companyId, companyId),
              eq(messagingSubscriptions.provider, provider),
              eq(messagingSubscriptions.messageType, messageType),
            ),
          )
          .then((rows) => rows[0] ?? null);

        if (existing) {
          const [updated] = await db
            .update(messagingSubscriptions)
            .set({ enabled, includeImage, updatedAt: now })
            .where(eq(messagingSubscriptions.id, existing.id))
            .returning();
          res.json(updated);
        } else {
          const [created] = await db
            .insert(messagingSubscriptions)
            .values({
              companyId,
              provider,
              messageType,
              enabled,
              includeImage,
              createdAt: now,
              updatedAt: now,
            } as never)
            .returning();
          res.status(201).json(created);
        }
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
