import { z } from "zod";

export const SOCIAL_PLATFORMS = [
  "twitter",
  "linkedin",
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "pinterest",
  "threads",
] as const;

export const SOCIAL_ACCOUNT_STATUSES = ["active", "disconnected", "error"] as const;

export const SOCIAL_POST_STATUSES = [
  "draft",
  "proposed",
  "approved",
  "scheduled",
  "published",
  "rejected",
] as const;

export const createSocialAccountSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  handle: z.string().min(1).max(200),
  displayName: z.string().max(200).optional().nullable(),
  profileImageUrl: z.string().url().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type CreateSocialAccount = z.infer<typeof createSocialAccountSchema>;

export const updateSocialAccountSchema = createSocialAccountSchema.partial().extend({
  status: z.enum(SOCIAL_ACCOUNT_STATUSES).optional(),
});
export type UpdateSocialAccount = z.infer<typeof updateSocialAccountSchema>;

const socialPostDataSchema = z.object({
  hashtags: z.array(z.string()).optional(),
  mediaUrls: z.array(z.string()).optional(),
  link: z.string().url().optional().nullable(),
  altText: z.string().max(500).optional().nullable(),
  agentId: z.string().optional().nullable(),
}).optional().nullable();

export const createSocialPostSchema = z.object({
  accountId: z.string().optional().nullable(),
  title: z.string().min(1).max(300),
  body: z.string().max(10000).optional().default(""),
  status: z.enum(SOCIAL_POST_STATUSES).optional().default("draft"),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
  data: socialPostDataSchema,
});
export type CreateSocialPost = z.infer<typeof createSocialPostSchema>;

export const updateSocialPostSchema = createSocialPostSchema.partial();
export type UpdateSocialPost = z.infer<typeof updateSocialPostSchema>;
