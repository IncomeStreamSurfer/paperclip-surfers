/**
 * Agent avatar generation via ComfyUI.
 * POST /agents/:id/generate-avatar
 * POST /agents/:id/expand-avatar-prompt
 *
 * Fallback: if the preferred checkpoint fails, retries with the next available checkpoint.
 */

import { Router } from "express";
import { z } from "zod";
import type { Db } from "@paperclipai/db";
import type { StorageService } from "../storage/types.js";
import { agentService, assetService, comfyuiService, logActivity } from "../services/index.js";
import { assertBoard, assertCompanyAccess, getActorInfo } from "./authz.js";
import { validate } from "../middleware/validate.js";

const AVATAR_STYLES = [
  "realistic",
  "cartoon",
  "anime",
  "oil-painting",
  "watercolor",
  "pixel-art",
  "3d-render",
  "sketch",
] as const;

const generateAvatarSchema = z.object({
  style: z.enum(AVATAR_STYLES).optional().default("realistic"),
  gender: z.enum(["male", "female", "neutral"]).optional().default("neutral"),
  seed: z.number().int().min(0).optional(),
  customPrompt: z.string().max(2000).optional(),
  /** Temperature 1–10. Low = strict prompt adherence; high = more creative variation. */
  temperature: z.number().min(1).max(10).optional().default(5),
});

const expandPromptSchema = z.object({
  description: z.string().max(500).optional().default(""),
  style: z.enum(AVATAR_STYLES).optional().default("realistic"),
  gender: z.enum(["male", "female", "neutral"]).optional().default("neutral"),
});

export function agentAvatarRoutes(db: Db, storage: StorageService) {
  const router = Router();
  const svc = agentService(db);
  const assetSvc = assetService(db);

  router.post(
    "/agents/:id/expand-avatar-prompt",
    validate(expandPromptSchema),
    async (req, res) => {
      req.socket.setTimeout(0);
      assertBoard(req);
      const id = req.params.id as string;
      const agent = await svc.getById(id);
      if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
      assertCompanyAccess(req, agent.companyId);

      const { description: rawDescription, style, gender } = req.body as z.infer<typeof expandPromptSchema>;

      let description = rawDescription?.trim() ?? "";
      if (!description) {
        const parts: string[] = [agent.name];
        if (agent.title) parts.push(agent.title);
        if ((agent as Record<string, unknown>).role) parts.push((agent as Record<string, unknown>).role as string);
        if (agent.capabilities) parts.push(agent.capabilities);
        description = parts.join(", ");
      }

      try {
        const expanded = await comfyuiService.expandPrompt(description, style, gender);
        res.json({ prompt: expanded });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Prompt expansion failed";
        res.status(502).json({ error: message });
      }
    },
  );

  router.post(
    "/agents/:id/generate-avatar",
    validate(generateAvatarSchema),
    async (req, res) => {
      req.socket.setTimeout(0);
      assertBoard(req);

      const id = req.params.id as string;
      const agent = await svc.getById(id);
      if (!agent) { res.status(404).json({ error: "Agent not found" }); return; }
      assertCompanyAccess(req, agent.companyId);

      if (!comfyuiService.isConfigured()) {
        res.status(503).json({ error: "ComfyUI is not configured (set COMFYUI_URL)" });
        return;
      }

      const { style, gender, seed, customPrompt, temperature } =
        req.body as z.infer<typeof generateAvatarSchema>;

      // ── Checkpoint selection with fallback ─────────────────────────────────
      const availableCheckpoints = await comfyuiService.getCheckpoints();

      if (availableCheckpoints.length === 0) {
        res.status(503).json({
          error: "No image generation models are available in ComfyUI. Add a checkpoint first.",
        });
        return;
      }

      const preferred = comfyuiService.pickCheckpoint(style, availableCheckpoints);
      // Build ordered list: preferred first, then others for fallback
      const checkpointOrder: string[] = preferred
        ? [preferred, ...availableCheckpoints.filter((c) => c !== preferred)]
        : [...availableCheckpoints];

      // ── Try each checkpoint in order ───────────────────────────────────────
      let imageBuffer: Buffer | undefined;
      let lastError: Error = new Error("No checkpoints tried");

      for (const checkpoint of checkpointOrder) {
        try {
          imageBuffer = await comfyuiService.generateAvatar({
            agentName: agent.name,
            style,
            gender,
            seed,
            customPrompt,
            checkpoint,
            temperature,
          });
          break; // success — stop trying
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          // Log and try next checkpoint
          console.warn(
            `[avatar] checkpoint "${checkpoint}" failed: ${lastError.message} — trying next`,
          );
        }
      }

      if (!imageBuffer) {
        res.status(502).json({ error: `All checkpoints failed. Last error: ${lastError.message}` });
        return;
      }

      // ── Store + persist ────────────────────────────────────────────────────
      const actor = getActorInfo(req);
      const stored = await storage.putFile({
        companyId: agent.companyId,
        namespace: `assets/agents/${agent.id}/avatar`,
        originalFilename: `${agent.name.replace(/\s+/g, "-").toLowerCase()}-avatar.png`,
        contentType: "image/png",
        body: imageBuffer,
      });

      const asset = await assetSvc.create(agent.companyId, {
        provider: stored.provider,
        objectKey: stored.objectKey,
        contentType: stored.contentType,
        byteSize: stored.byteSize,
        sha256: stored.sha256,
        originalFilename: stored.originalFilename,
        createdByAgentId: actor.agentId,
        createdByUserId: actor.actorType === "user" ? actor.actorId : null,
      });

      const avatarUrl = `/api/assets/${asset.id}/content`;
      await svc.update(id, { avatarUrl });

      await logActivity(db, {
        companyId: agent.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        runId: actor.runId,
        action: "agent.avatar_generated",
        entityType: "agent",
        entityId: agent.id,
        details: { style, gender, temperature, assetId: asset.id },
      });

      res.json({ avatarUrl });
    },
  );

  return router;
}
