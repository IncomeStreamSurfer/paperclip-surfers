/**
 * Graphic Design module routes.
 *
 * POST /companies/:companyId/design/assets/generate  — generate image via ComfyUI
 * POST /companies/:companyId/design/assets/expand-prompt — expand prompt via Ollama
 * GET  /companies/:companyId/design/assets           — list assets
 * GET  /companies/:companyId/design/stats            — status counts
 * GET  /design/assets/:assetId                       — get one
 * PATCH /design/assets/:assetId                      — update title/notes
 * DELETE /design/assets/:assetId                     — delete
 */

import { Router } from "express";
import type { Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import {
  generateDesignAssetSchema,
  updateDesignAssetSchema,
  listDesignAssetsSchema,
  DESIGN_ASPECT_RATIOS,
} from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { designService } from "../services/design.js";
import { assetService, comfyuiService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import type { AvatarStyle } from "../services/comfyui.js";
import { z } from "zod";

const expandPromptSchema = z.object({
  description: z.string().min(1).max(2000),
  style: z.enum(["realistic", "cartoon", "anime", "oil-painting", "watercolor", "pixel-art", "3d-render", "sketch"]).default("realistic"),
});

export function designRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = designService(db);
  const assetSvc = assetService(db);

  // ── Expand prompt ────────────────────────────────────────────────────────────

  router.post(
    "/companies/:companyId/design/assets/expand-prompt",
    validate(expandPromptSchema),
    async (req, res) => {
      req.socket.setTimeout(0);
      assertBoard(req);
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const { description, style } = req.body as { description: string; style: AvatarStyle };

      const expanded = await comfyuiService.expandDesignPrompt(description, style);
      res.json({ prompt: expanded });
    },
  );

  // ── Generate ─────────────────────────────────────────────────────────────────

  router.post(
    "/companies/:companyId/design/assets/generate",
    validate(generateDesignAssetSchema),
    async (req, res) => {
      req.socket.setTimeout(0);
      assertBoard(req);
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      if (!comfyuiService.isConfigured()) {
        res.status(503).json({ error: "ComfyUI is not configured (set COMFYUI_URL)" });
        return;
      }

      const {
        title,
        prompt,
        style,
        aspectRatio,
        seed: requestedSeed,
        temperature,
        expandPrompt,
      } = req.body as {
        title: string;
        prompt: string;
        style: AvatarStyle;
        aspectRatio: string;
        seed?: number;
        temperature: number;
        expandPrompt: boolean;
      };

      // Resolve dimensions
      const dims = DESIGN_ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? DESIGN_ASPECT_RATIOS[0]!;
      const { width, height } = dims;

      // Optionally expand the prompt
      let resolvedPrompt = prompt;
      if (expandPrompt) {
        try {
          resolvedPrompt = await comfyuiService.expandDesignPrompt(prompt, style);
        } catch {
          // Non-fatal — fall back to raw prompt
        }
      }

      // Get available checkpoints with fallback
      const availableCheckpoints = await comfyuiService.getCheckpoints();
      if (availableCheckpoints.length === 0) {
        res.status(503).json({
          error: "No image generation models available in ComfyUI. Add a checkpoint first.",
        });
        return;
      }

      const preferred = comfyuiService.pickCheckpoint(style, availableCheckpoints);
      const checkpointOrder: string[] = preferred
        ? [preferred, ...availableCheckpoints.filter((c) => c !== preferred)]
        : [...availableCheckpoints];

      // CFG from temperature
      const cfg = Math.max(2, Math.round(15 - temperature * 1.3));

      // Create placeholder record
      const actor = getActorInfo(req);
      const record = await svc.createPending(companyId, {
        title,
        prompt,
        expandedPrompt: expandPrompt ? resolvedPrompt : null,
        style,
        width,
        height,
        steps: 22,
        cfg,
        seed: requestedSeed ?? null,
      });

      // Attempt generation with checkpoint fallback
      let imageBuffer: Buffer | undefined;
      let usedCheckpoint = checkpointOrder[0]!;
      let finalSeed = requestedSeed ?? Math.floor(Math.random() * 2 ** 32);
      let lastError: Error = new Error("No checkpoints tried");

      for (const checkpoint of checkpointOrder) {
        try {
          const result = await comfyuiService.generateImage({
            positivePrompt: resolvedPrompt,
            checkpoint,
            seed: requestedSeed,
            width,
            height,
            steps: 22,
            cfg,
          });
          imageBuffer = result.imageBuffer;
          finalSeed = result.seed;
          usedCheckpoint = checkpoint;
          break;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[design] checkpoint "${checkpoint}" failed: ${lastError.message} — trying next`);
        }
      }

      if (!imageBuffer) {
        await svc.markFailed(record!.id, `All checkpoints failed. Last error: ${lastError.message}`);
        res.status(502).json({ error: `Generation failed: ${lastError.message}` });
        return;
      }

      // Store in object storage
      const safeName = title.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase().slice(0, 50);
      const stored = await storage.putFile({
        companyId,
        namespace: `assets/design/${record!.id}`,
        originalFilename: `${safeName}.png`,
        contentType: "image/png",
        body: imageBuffer,
      });

      const asset = await assetSvc.create(companyId, {
        provider: stored.provider,
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        originalFilename: stored.originalFilename,
        createdByAgentId: actor.agentId,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      });

      const imageUrl = `/api/assets/${asset.id}/content`;

      const updated = await svc.markDone(record!.id, {
        checkpointUsed: usedCheckpoint,
        assetId: asset.id,
        imageUrl,
        seed: finalSeed,
      });

      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "design_asset.generated",
        entityType: "design_asset",
        entityId: record!.id,
        details: { title, style, aspectRatio, checkpoint: usedCheckpoint },
      });

      res.status(201).json(updated);
    },
  );

  // ── List ─────────────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/design/assets", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const parsed = listDesignAssetsSchema.safeParse(req.query);
    const q = parsed.success ? parsed.data : { limit: 50, offset: 0 };
    const assets = await svc.list(companyId, q);
    res.json(assets);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/design/stats", async (req, res) => {
    const { companyId } = req.params as { companyId: string };
    assertCompanyAccess(req, companyId);
    const counts = await svc.countByStatus(companyId);
    res.json(counts);
  });

  // ── Get one ───────────────────────────────────────────────────────────────────

  router.get("/design/assets/:assetId", async (req, res) => {
    const { assetId } = req.params as { assetId: string };
    const record = await svc.getById(assetId);
    if (!record) { res.status(404).json({ error: "Design asset not found" }); return; }
    assertCompanyAccess(req, record.companyId);
    res.json(record);
  });

  // ── Update ───────────────────────────────────────────────────────────────────

  router.patch(
    "/design/assets/:assetId",
    validate(updateDesignAssetSchema),
    async (req, res) => {
      const { assetId } = req.params as { assetId: string };
      const existing = await svc.getById(assetId);
      if (!existing) { res.status(404).json({ error: "Design asset not found" }); return; }
      assertCompanyAccess(req, existing.companyId);
      const updated = await svc.update(assetId, req.body);
      res.json(updated);
    },
  );

  // ── Delete ───────────────────────────────────────────────────────────────────

  router.delete("/design/assets/:assetId", async (req, res) => {
    const { assetId } = req.params as { assetId: string };
    const existing = await svc.getById(assetId);
    if (!existing) { res.status(404).json({ error: "Design asset not found" }); return; }
    assertCompanyAccess(req, existing.companyId);
    await svc.delete(assetId);
    res.status(204).end();
  });

  return router;
}
