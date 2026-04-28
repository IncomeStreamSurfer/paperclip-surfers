import { z } from "zod";

export const CIVIL_PROJECT_TYPES = [
  "general",
  "residential",
  "commercial",
  "infrastructure",
  "industrial",
  "landscape",
] as const;

export const CIVIL_PROJECT_STATUSES = [
  "planning",
  "design",
  "approval",
  "construction",
  "complete",
  "on_hold",
] as const;

export const CIVIL_DRAWING_TYPES = [
  "plan",
  "elevation",
  "section",
  "detail",
  "site",
  "structural",
  "mep",
  "landscape",
] as const;

export const CIVIL_DRAWING_STATUSES = ["draft", "in_review", "approved", "superseded"] as const;
export const CIVIL_SPEC_STATUSES = ["draft", "issued", "superseded"] as const;

export const createCivilProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  projectType: z.enum(CIVIL_PROJECT_TYPES).optional().default("general"),
  status: z.enum(CIVIL_PROJECT_STATUSES).optional().default("planning"),
  location: z.string().max(500).nullable().optional(),
  clientName: z.string().max(200).nullable().optional(),
  estimatedBudget: z.string().max(100).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});
export type CreateCivilProject = z.infer<typeof createCivilProjectSchema>;
export const updateCivilProjectSchema = createCivilProjectSchema.partial();
export type UpdateCivilProject = z.infer<typeof updateCivilProjectSchema>;

export const createCivilDrawingSchema = z.object({
  title: z.string().min(1).max(300),
  projectId: z.string().uuid().nullable().optional(),
  drawingNumber: z.string().max(100).nullable().optional(),
  drawingType: z.enum(CIVIL_DRAWING_TYPES).optional().default("plan"),
  status: z.enum(CIVIL_DRAWING_STATUSES).optional().default("draft"),
  revision: z.string().max(20).optional().default("A"),
  discipline: z.string().max(100).nullable().optional(),
  scale: z.string().max(50).nullable().optional(),
  fileUrl: z.string().max(2000).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type CreateCivilDrawing = z.infer<typeof createCivilDrawingSchema>;
export const updateCivilDrawingSchema = createCivilDrawingSchema.partial();
export type UpdateCivilDrawing = z.infer<typeof updateCivilDrawingSchema>;

export const createCivilSpecificationSchema = z.object({
  title: z.string().min(1).max(300),
  projectId: z.string().uuid().nullable().optional(),
  sectionNumber: z.string().max(50).nullable().optional(),
  content: z.string().max(100000).nullable().optional(),
  status: z.enum(CIVIL_SPEC_STATUSES).optional().default("draft"),
});
export type CreateCivilSpecification = z.infer<typeof createCivilSpecificationSchema>;
export const updateCivilSpecificationSchema = createCivilSpecificationSchema.partial();
export type UpdateCivilSpecification = z.infer<typeof updateCivilSpecificationSchema>;
