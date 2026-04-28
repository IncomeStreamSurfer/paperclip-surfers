export interface InstanceGeneralSettings {
  censorUsernameInLogs: boolean;
  faviconAssetId?: string | null;
  appIconAssetId?: string | null;
  siteTitle?: string | null;
}

export interface InstanceExperimentalSettings {
  enableIsolatedWorkspaces: boolean;
  autoRestartDevServerWhenIdle: boolean;
}

export interface InstanceNotificationSettings {
  enabled: boolean;
  notificationEmail: string | null;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
  emailProvider: "smtp" | "mailgun" | "sendgrid";
  mailgunDomain: string | null;
  mailgunApiKey: string | null;
  sendgridApiKey: string | null;
  /** Which HTML wrapper template to use for outgoing system emails */
  emailTemplate?: "clean" | "branded" | "dark" | "card" | "corporate";
  /** Public URL of the app — used for links in email headers/footers */
  emailAppUrl?: string | null;
}

export interface InstanceSettings {
  id: string;
  general: InstanceGeneralSettings;
  experimental: InstanceExperimentalSettings;
  notifications: InstanceNotificationSettings;
  createdAt: Date;
  updatedAt: Date;
}
