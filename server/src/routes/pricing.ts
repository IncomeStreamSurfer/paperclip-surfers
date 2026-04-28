import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { modelPricing } from "@paperclipai/db";
import { createModelPricingSchema, updateModelPricingSchema, modelPricingLookupSchema } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { assertBoard } from "./authz.js";
import { pricingService } from "../services/pricing.js";
import { forbidden } from "../errors.js";

function assertInstanceAdmin(req: { actor: { isInstanceAdmin?: boolean; source?: string; type?: string } }) {
  if (req.actor.type !== "board") throw forbidden("Board access required");
  if (req.actor.isInstanceAdmin || req.actor.source === "local_implicit") return;
  throw forbidden("Instance admin access required");
}

export function pricingRoutes(db: Db) {
  const router = Router();
  const svc = pricingService(db);

  // List all pricing entries
  router.get("/pricing", async (req, res, next) => {
    try {
      assertBoard(req);
      const provider = req.query.provider as string | undefined;
      const rows = await svc.list({ provider, isActive: true });
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // Get single pricing entry
  router.get("/pricing/:id", async (req, res, next) => {
    try {
      assertBoard(req);
      const row = await svc.getById(req.params.id as string);
      if (!row) {
        res.status(404).json({ error: "Pricing entry not found" });
        return;
      }
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  // Create pricing entry (instance admin only)
  router.post("/pricing", validate(createModelPricingSchema), async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const body = req.body as z.infer<typeof createModelPricingSchema>;
      const row = await svc.create({
        provider: body.provider,
        modelId: body.modelId,
        modelName: body.modelName,
        inputPriceCentsPer1M: body.inputPriceCentsPer1M,
        outputPriceCentsPer1M: body.outputPriceCentsPer1M,
        cachedInputPriceCentsPer1M: body.cachedInputPriceCentsPer1M,
        currency: body.currency,
        contextWindow: body.contextWindow,
        isActive: body.isActive,
        effectiveFrom: body.effectiveFrom ? new Date(body.effectiveFrom) : undefined,
      });
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  });

  // Update pricing entry (instance admin only)
  router.patch("/pricing/:id", validate(updateModelPricingSchema), async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      const body = req.body as z.infer<typeof updateModelPricingSchema>;
      const row = await svc.update(req.params.id as string, {
        modelName: body.modelName,
        inputPriceCentsPer1M: body.inputPriceCentsPer1M,
        outputPriceCentsPer1M: body.outputPriceCentsPer1M,
        cachedInputPriceCentsPer1M: body.cachedInputPriceCentsPer1M,
        currency: body.currency,
        contextWindow: body.contextWindow,
        isActive: body.isActive,
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
      });
      if (!row) {
        res.status(404).json({ error: "Pricing entry not found" });
        return;
      }
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  // Delete pricing entry (instance admin only)
  router.delete("/pricing/:id", async (req, res, next) => {
    try {
      assertInstanceAdmin(req);
      await svc.delete(req.params.id as string);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Calculate cost for a given provider/model/token usage
  router.post("/pricing/calculate", validate(modelPricingLookupSchema), async (req, res, next) => {
    try {
      assertBoard(req);
      const body = req.body as z.infer<typeof modelPricingLookupSchema>;
      const result = await svc.calculateCost(body.provider, body.modelId, {
        inputTokens: body.inputTokens,
        outputTokens: body.outputTokens,
        cachedInputTokens: body.cachedInputTokens,
      });
      if (!result) {
        res.status(404).json({ error: "Pricing not found for provider/model" });
        return;
      }
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
