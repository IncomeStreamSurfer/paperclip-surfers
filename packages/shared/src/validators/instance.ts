import { z } from "zod";

export const instanceGeneralSettingsSchema = z.object({
  censorUsernameInLogs: z.boolean().default(false),
  faviconAssetId: z.string().uuid().nullable().optional(),
  appIconAssetId: z.string().uuid().nullable().optional(),
  siteTitle: z.string().max(100).nullable().optional(),
  /** "container" = all data lives inside the Docker container; "host" = paths mounted from host. */
  workspaceMode: z.enum(["container", "host"]).default("container").optional(),
  /**
   * Absolute paths for each workspace directory.
   * Defaults to /paperclip/workspace/{type} in container mode.
   * Set by the user during onboarding when workspaceMode = "host".
   */
  workspacePaths: z
    .object({
      code: z.string().optional(),
      notes: z.string().optional(),
      design: z.string().optional(),
      cad: z.string().optional(),
    })
    .optional(),
  /** Set to true after workspace configuration is completed in the onboarding wizard. */
  workspaceConfigured: z.boolean().default(false).optional(),
}).strict();

export const patchInstanceGeneralSettingsSchema = instanceGeneralSettingsSchema.partial();

export const instanceExperimentalSettingsSchema = z.object({
  enableIsolatedWorkspaces: z.boolean().default(false),
  autoRestartDevServerWhenIdle: z.boolean().default(false),
}).strict();

export const patchInstanceExperimentalSettingsSchema = instanceExperimentalSettingsSchema.partial();

export const EMAIL_TEMPLATE_IDS = ["clean", "branded", "dark", "card", "corporate"] as const;
export type EmailTemplateId = typeof EMAIL_TEMPLATE_IDS[number];

export const instanceNotificationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  notificationEmail: z.string().email().nullable().optional().default(null),
  smtpHost: z.string().nullable().optional().default(null),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().nullable().optional().default(null),
  smtpPassword: z.string().nullable().optional().default(null),
  smtpFrom: z.string().nullable().optional().default(null),
  /** "smtp" (default) uses the configured SMTP fields; "mailgun" uses Mailgun SMTP relay; "sendgrid" uses SendGrid SMTP relay */
  emailProvider: z.enum(["smtp", "mailgun", "sendgrid"]).default("smtp"),
  mailgunDomain: z.string().nullable().optional().default(null),
  mailgunApiKey: z.string().nullable().optional().default(null),
  sendgridApiKey: z.string().nullable().optional().default(null),
  /** Which HTML wrapper template to use for outgoing system emails */
  emailTemplate: z.enum(EMAIL_TEMPLATE_IDS).default("clean").optional(),
  /** Public URL of the app — used for links in email headers/footers */
  emailAppUrl: z.string().nullable().optional().default(null),
}).strict();

export const patchInstanceNotificationSettingsSchema = instanceNotificationSettingsSchema.partial();

export type InstanceGeneralSettings = z.infer<typeof instanceGeneralSettingsSchema>;
export type PatchInstanceGeneralSettings = z.infer<typeof patchInstanceGeneralSettingsSchema>;
export type InstanceExperimentalSettings = z.infer<typeof instanceExperimentalSettingsSchema>;
export type PatchInstanceExperimentalSettings = z.infer<typeof patchInstanceExperimentalSettingsSchema>;
export type InstanceNotificationSettings = z.infer<typeof instanceNotificationSettingsSchema>;
export type PatchInstanceNotificationSettings = z.infer<typeof patchInstanceNotificationSettingsSchema>;
