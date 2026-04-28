import { z } from "zod";

export const SEO_PAGE_STATUSES = ["draft", "published", "needs-work"] as const;

// ---- Keywords ----

export const createSeoKeywordSchema = z.object({
  keyword: z.string().min(1).max(500),
  targetUrl: z.string().url().optional().nullable(),
  searchVolume: z.number().int().nonnegative().optional().nullable(),
  difficulty: z.number().int().min(0).max(100).optional().nullable(),
  currentRank: z.number().int().nonnegative().optional().nullable(),
  targetRank: z.number().int().nonnegative().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateSeoKeyword = z.infer<typeof createSeoKeywordSchema>;

export const updateSeoKeywordSchema = createSeoKeywordSchema.partial();
export type UpdateSeoKeyword = z.infer<typeof updateSeoKeywordSchema>;

// ---- Pages ----

export const createSeoPageSchema = z.object({
  url: z.string().min(1).max(2000),
  title: z.string().max(500).optional().nullable(),
  metaDescription: z.string().max(1000).optional().nullable(),
  h1: z.string().max(500).optional().nullable(),
  focusKeyword: z.string().max(500).optional().nullable(),
  seoScore: z.number().int().min(0).max(100).optional().nullable(),
  status: z.enum(SEO_PAGE_STATUSES).optional().default("draft"),
  notes: z.string().max(2000).optional().nullable(),
});
export type CreateSeoPage = z.infer<typeof createSeoPageSchema>;

export const updateSeoPageSchema = createSeoPageSchema.partial();
export type UpdateSeoPage = z.infer<typeof updateSeoPageSchema>;
