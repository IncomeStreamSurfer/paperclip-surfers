import { z } from "zod";

export const SPRINT_STATUSES = ["planning", "active", "completed", "cancelled"] as const;

export const createSprintSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().max(2000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  status: z.enum(SPRINT_STATUSES).optional().default("planning"),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});
export type CreateSprint = z.infer<typeof createSprintSchema>;

export const updateSprintSchema = createSprintSchema.partial().extend({
  completedAt: z.string().datetime().nullable().optional(),
});
export type UpdateSprint = z.infer<typeof updateSprintSchema>;

/** Shape returned by GET /sprints/:id/velocity */
export type SprintVelocity = {
  sprintId: string;
  totalIssues: number;
  completedIssues: number;
  completionRate: number;
  /** Issues completed per calendar day */
  dailyRate: number | null;
};

/** Shape of the AI-generated sprint report stored in sprints.aiReport */
export type SprintAiReport = {
  summary: string;
  velocity: number;
  completionRate: number;
  topAccomplishments: string[];
  risks: string[];
  recommendations: string[];
  generatedAt: string;
};
