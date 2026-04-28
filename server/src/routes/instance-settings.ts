import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import {
  patchInstanceExperimentalSettingsSchema,
  patchInstanceGeneralSettingsSchema,
  patchInstanceNotificationSettingsSchema,
} from "@paperclipai/shared";
import { forbidden } from "../errors.js";
import { validate } from "../middleware/validate.js";
import { instanceSettingsService, logActivity, emailService } from "../services/index.js";
import { getActorInfo } from "./authz.js";

function assertCanManageInstanceSettings(req: Request) {
  if (req.actor.type !== "board") {
    throw forbidden("Board access required");
  }
  if (req.actor.source === "local_implicit" || req.actor.isInstanceAdmin) {
    return;
  }
  throw forbidden("Instance admin access required");
}

export function instanceSettingsRoutes(db: Db) {
  const router = Router();
  const svc = instanceSettingsService(db);

  // ── Public branding endpoint (no auth required) ──────────────────────────

  router.get("/instance/branding", async (_req, res) => {
    const general = await svc.getGeneral();
    const faviconUrl = general.faviconAssetId
      ? `/api/assets/${general.faviconAssetId}/content`
      : null;
    const appIconUrl = general.appIconAssetId
      ? `/api/assets/${general.appIconAssetId}/content`
      : null;
    res.json({
      faviconUrl,
      appIconUrl,
      siteTitle: general.siteTitle ?? null,
    });
  });

  // ── Dynamic PWA manifest (no auth required) ───────────────────────────────

  router.get("/instance/manifest.webmanifest", async (_req, res) => {
    const general = await svc.getGeneral();
    const name = general.siteTitle ?? "Paperclip";
    const shortName = name.length > 12 ? name.slice(0, 12) : name;
    const iconUrl = general.appIconAssetId
      ? `/api/assets/${general.appIconAssetId}/content`
      : null;
    const icons = iconUrl
      ? [
          { src: iconUrl, sizes: "192x192", type: "image/png" },
          { src: iconUrl, sizes: "512x512", type: "image/png" },
          { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "maskable" },
        ]
      : [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ];
    res.setHeader("Content-Type", "application/manifest+json");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.json({
      id: "/",
      name,
      short_name: shortName,
      description: "AI-powered project management and agent coordination platform",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "any",
      theme_color: "#18181b",
      background_color: "#18181b",
      icons,
    });
  });

  router.get("/instance/settings/general", async (req, res) => {
    assertCanManageInstanceSettings(req);
    res.json(await svc.getGeneral());
  });

  router.patch(
    "/instance/settings/general",
    validate(patchInstanceGeneralSettingsSchema),
    async (req, res) => {
      assertCanManageInstanceSettings(req);
      const updated = await svc.updateGeneral(req.body);
      const actor = getActorInfo(req);
      const companyIds = await svc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            action: "instance.settings.general_updated",
            entityType: "instance_settings",
            entityId: updated.id,
            details: {
              general: updated.general,
              changedKeys: Object.keys(req.body).sort(),
            },
          }),
        ),
      );
      res.json(updated.general);
    },
  );

  router.get("/instance/settings/experimental", async (req, res) => {
    assertCanManageInstanceSettings(req);
    res.json(await svc.getExperimental());
  });

  router.patch(
    "/instance/settings/experimental",
    validate(patchInstanceExperimentalSettingsSchema),
    async (req, res) => {
      assertCanManageInstanceSettings(req);
      const updated = await svc.updateExperimental(req.body);
      const actor = getActorInfo(req);
      const companyIds = await svc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            action: "instance.settings.experimental_updated",
            entityType: "instance_settings",
            entityId: updated.id,
            details: {
              experimental: updated.experimental,
              changedKeys: Object.keys(req.body).sort(),
            },
          }),
        ),
      );
      res.json(updated.experimental);
    },
  );

  router.get("/instance/settings/notifications", async (req, res) => {
    assertCanManageInstanceSettings(req);
    const notifications = await svc.getNotifications();
    // Never expose the SMTP password to the client
    res.json({ ...notifications, smtpPassword: notifications.smtpPassword ? "••••••••" : null });
  });

  router.patch(
    "/instance/settings/notifications",
    validate(patchInstanceNotificationSettingsSchema),
    async (req, res) => {
      assertCanManageInstanceSettings(req);
      // If client sends back the masked placeholder, strip it so we don't overwrite the real value
      const patch = { ...req.body };
      if (patch.smtpPassword === "••••••••") {
        delete patch.smtpPassword;
      }
      const updated = await svc.updateNotifications(patch);
      const actor = getActorInfo(req);
      const companyIds = await svc.listCompanyIds();
      await Promise.all(
        companyIds.map((companyId) =>
          logActivity(db, {
            companyId,
            actorType: actor.actorType,
            actorId: actor.actorId,
            agentId: actor.agentId,
            runId: actor.runId,
            action: "instance.settings.notifications_updated",
            entityType: "instance_settings",
            entityId: updated.id,
            details: {
              changedKeys: Object.keys(patch).sort(),
            },
          }),
        ),
      );
      const notifications = updated.notifications;
      res.json({ ...notifications, smtpPassword: notifications.smtpPassword ? "••••••••" : null });
    },
  );

  router.post("/instance/settings/notifications/test", async (req, res) => {
    assertCanManageInstanceSettings(req);
    const { to } = req.body as { to?: string };
    if (!to || typeof to !== "string") {
      res.status(400).json({ error: "to email address is required" });
      return;
    }
    const emails = emailService(db);
    try {
      await emails.sendTestEmail(to);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to send test email";
      res.status(422).json({ error: message });
    }
  });

  return router;
}

