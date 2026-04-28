import { z } from "zod";

export const RESEARCH_PROJECT_STATUSES = ["active", "completed", "paused", "archived"] as const;

export const createResearchProjectSchema = z.object({
  title: z.string().min(1).max(200),
  abstract: z.string().max(5000).nullable().optional(),
  domain: z.string().max(100).nullable().optional(),
  status: z.enum(RESEARCH_PROJECT_STATUSES).optional().default("active"),
});
export type CreateResearchProject = z.infer<typeof createResearchProjectSchema>;
export const updateResearchProjectSchema = createResearchProjectSchema.partial();
export type UpdateResearchProject = z.infer<typeof updateResearchProjectSchema>;

export const createResearchNoteSchema = z.object({
  content: z.string().min(1).max(20000),
  projectId: z.string().uuid().nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
});
export type CreateResearchNote = z.infer<typeof createResearchNoteSchema>;
export const updateResearchNoteSchema = createResearchNoteSchema.partial();
export type UpdateResearchNote = z.infer<typeof updateResearchNoteSchema>;

export const createResearchLiteratureSchema = z.object({
  title: z.string().min(1).max(500),
  authors: z.string().max(500).nullable().optional(),
  year: z.string().max(20).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});
export type CreateResearchLiterature = z.infer<typeof createResearchLiteratureSchema>;
export const updateResearchLiteratureSchema = createResearchLiteratureSchema.partial();
export type UpdateResearchLiterature = z.infer<typeof updateResearchLiteratureSchema>;
