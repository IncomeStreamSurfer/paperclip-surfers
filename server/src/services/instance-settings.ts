import type { Db } from "@paperclipai/db";
import { companies, instanceSettings } from "@paperclipai/db";
import {
  instanceGeneralSettingsSchema,
  type InstanceGeneralSettings,
  instanceExperimentalSettingsSchema,
  type InstanceExperimentalSettings,
  instanceNotificationSettingsSchema,
  type InstanceNotificationSettings,
  type PatchInstanceGeneralSettings,
  type InstanceSettings,
  type PatchInstanceExperimentalSettings,
  type PatchInstanceNotificationSettings,
} from "@paperclipai/shared";
import { eq } from "drizzle-orm";

const DEFAULT_SINGLETON_KEY = "default";

function normalizeGeneralSettings(raw: unknown): InstanceGeneralSettings {
  const parsed = instanceGeneralSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return {
      censorUsernameInLogs: parsed.data.censorUsernameInLogs ?? false,
      faviconAssetId: parsed.data.faviconAssetId ?? null,
      appIconAssetId: parsed.data.appIconAssetId ?? null,
      siteTitle: parsed.data.siteTitle ?? null,
    };
  }
  return {
    censorUsernameInLogs: false,
    faviconAssetId: null,
    appIconAssetId: null,
    siteTitle: null,
  };
}

function normalizeExperimentalSettings(raw: unknown): InstanceExperimentalSettings {
  const parsed = instanceExperimentalSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return {
      enableIsolatedWorkspaces: parsed.data.enableIsolatedWorkspaces ?? false,
      autoRestartDevServerWhenIdle: parsed.data.autoRestartDevServerWhenIdle ?? false,
    };
  }
  return {
    enableIsolatedWorkspaces: false,
    autoRestartDevServerWhenIdle: false,
  };
}

function normalizeNotificationSettings(raw: unknown): InstanceNotificationSettings {
  const parsed = instanceNotificationSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) {
    return {
      enabled: parsed.data.enabled ?? false,
      notificationEmail: parsed.data.notificationEmail ?? null,
      smtpHost: parsed.data.smtpHost ?? null,
      smtpPort: parsed.data.smtpPort ?? 587,
      smtpSecure: parsed.data.smtpSecure ?? false,
      smtpUser: parsed.data.smtpUser ?? null,
      smtpPassword: parsed.data.smtpPassword ?? null,
      smtpFrom: parsed.data.smtpFrom ?? null,
      emailProvider: parsed.data.emailProvider ?? "smtp",
      mailgunDomain: parsed.data.mailgunDomain ?? null,
      mailgunApiKey: parsed.data.mailgunApiKey ?? null,
      sendgridApiKey: parsed.data.sendgridApiKey ?? null,
      emailTemplate: parsed.data.emailTemplate ?? "clean",
      emailAppUrl: parsed.data.emailAppUrl ?? null,
    };
  }
  return {
    enabled: false,
    notificationEmail: null,
    smtpHost: null,
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: null,
    smtpPassword: null,
    smtpFrom: null,
    emailProvider: "smtp",
    mailgunDomain: null,
    mailgunApiKey: null,
    sendgridApiKey: null,
    emailTemplate: "clean",
    emailAppUrl: null,
  };
}

function toInstanceSettings(row: typeof instanceSettings.$inferSelect): InstanceSettings {
  return {
    id: row.id,
    general: normalizeGeneralSettings(row.general),
    experimental: normalizeExperimentalSettings(row.experimental),
    notifications: normalizeNotificationSettings(row.notifications),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function instanceSettingsService(db: Db) {
  async function getOrCreateRow() {
    const existing = await db
      .select()
      .from(instanceSettings)
      .where(eq(instanceSettings.singletonKey, DEFAULT_SINGLETON_KEY))
      .then((rows) => rows[0] ?? null);
    if (existing) return existing;

    const now = new Date();
    const [created] = await db
      .insert(instanceSettings)
      .values({
        singletonKey: DEFAULT_SINGLETON_KEY,
        general: {},
        experimental: {},
        notifications: {},
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [instanceSettings.singletonKey],
        set: {
          updatedAt: now,
        },
      })
      .returning();

    return created;
  }

  return {
    get: async (): Promise<InstanceSettings> => toInstanceSettings(await getOrCreateRow()),

    getGeneral: async (): Promise<InstanceGeneralSettings> => {
      const row = await getOrCreateRow();
      return normalizeGeneralSettings(row.general);
    },

    getExperimental: async (): Promise<InstanceExperimentalSettings> => {
      const row = await getOrCreateRow();
      return normalizeExperimentalSettings(row.experimental);
    },

    getNotifications: async (): Promise<InstanceNotificationSettings> => {
      const row = await getOrCreateRow();
      return normalizeNotificationSettings(row.notifications);
    },

    updateGeneral: async (patch: PatchInstanceGeneralSettings): Promise<InstanceSettings> => {
      const current = await getOrCreateRow();
      const normalized = normalizeGeneralSettings(current.general);
      // Preserve unknown fields (e.g. API keys) from raw general while updating known ones
      const nextGeneral = {
        ...(current.general as Record<string, unknown> ?? {}),
        ...normalized,
        ...patch,
      };
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          general: nextGeneral,
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    updateExperimental: async (patch: PatchInstanceExperimentalSettings): Promise<InstanceSettings> => {
      const current = await getOrCreateRow();
      const nextExperimental = normalizeExperimentalSettings({
        ...normalizeExperimentalSettings(current.experimental),
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          experimental: { ...nextExperimental },
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    updateNotifications: async (patch: PatchInstanceNotificationSettings): Promise<InstanceSettings> => {
      const current = await getOrCreateRow();
      const nextNotifications = normalizeNotificationSettings({
        ...normalizeNotificationSettings(current.notifications),
        ...patch,
      });
      const now = new Date();
      const [updated] = await db
        .update(instanceSettings)
        .set({
          notifications: { ...nextNotifications },
          updatedAt: now,
        })
        .where(eq(instanceSettings.id, current.id))
        .returning();
      return toInstanceSettings(updated ?? current);
    },

    listCompanyIds: async (): Promise<string[]> =>
      db
        .select({ id: companies.id })
        .from(companies)
        .then((rows) => rows.map((row) => row.id)),
  };
}

