import { z } from "zod";

export const COPYWRITING_CONTENT_TYPES = [
  "blog-post",
  "article",
  "social-post",
  "email",
  "landing-page",
  "product-description",
  "press-release",
  "whitepaper",
  "case-study",
  "newsletter",
  "ad-copy",
  "other",
] as const;

export const COPYWRITING_BRIEF_STATUSES = [
  "draft",
  "in-progress",
  "review",
  "approved",
  "published",
] as const;

export const createCopywritingBriefSchema = z.object({
  title: z.string().min(1).max(500),
  contentType: z.enum(COPYWRITING_CONTENT_TYPES).default("blog-post"),
  status: z.enum(COPYWRITING_BRIEF_STATUSES).default("draft"),
  targetKeyword: z.string().max(500).optional().nullable(),
  targetAudience: z.string().max(1000).optional().nullable(),
  wordCountTarget: z.number().int().positive().optional().nullable(),
  dueDate: z.string().datetime().optional().nullable(),
  assignedAgentId: z.string().uuid().optional().nullable(),
  brief: z.string().max(10000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  generatedContent: z.string().optional().nullable(),
  generatedWordCount: z.number().int().nonnegative().optional().nullable(),
});

export type CreateCopywritingBrief = z.infer<typeof createCopywritingBriefSchema>;

export const updateCopywritingBriefSchema = createCopywritingBriefSchema.partial();
export type UpdateCopywritingBrief = z.infer<typeof updateCopywritingBriefSchema>;
