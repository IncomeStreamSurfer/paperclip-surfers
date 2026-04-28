import { z } from "zod";

export const MESSAGING_PROVIDERS = ["telegram", "whatsapp"] as const;
export type MessagingProvider = (typeof MESSAGING_PROVIDERS)[number];

export const MESSAGING_MESSAGE_TYPES = [
  "new_issue",
  "issue_blocked",
  "issue_completed",
  "run_hang",
  "daily_digest",
  "weekly_report",
] as const;
export type MessagingMessageType = (typeof MESSAGING_MESSAGE_TYPES)[number];

export const messagingProviderConfigSchema = z.record(z.unknown());

export const messagingProviderSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  provider: z.enum(MESSAGING_PROVIDERS),
  enabled: z.boolean(),
  config: messagingProviderConfigSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MessagingProviderRow = z.infer<typeof messagingProviderSchema>;

export const messagingSubscriptionSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  provider: z.enum(MESSAGING_PROVIDERS),
  messageType: z.enum(MESSAGING_MESSAGE_TYPES),
  enabled: z.boolean(),
  includeImage: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MessagingSubscription = z.infer<typeof messagingSubscriptionSchema>;

export const upsertMessagingProviderSchema = z.object({
  provider: z.enum(MESSAGING_PROVIDERS),
  enabled: z.boolean(),
  config: messagingProviderConfigSchema,
});

export type UpsertMessagingProvider = z.infer<typeof upsertMessagingProviderSchema>;

export const upsertMessagingSubscriptionSchema = z.object({
  provider: z.enum(MESSAGING_PROVIDERS),
  messageType: z.enum(MESSAGING_MESSAGE_TYPES),
  enabled: z.boolean(),
  includeImage: z.boolean(),
});

export type UpsertMessagingSubscription = z.infer<typeof upsertMessagingSubscriptionSchema>;
