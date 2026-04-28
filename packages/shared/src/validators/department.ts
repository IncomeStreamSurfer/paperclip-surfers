import { z } from "zod";

export const departmentMemoryEntrySchema = z.object({
  id: z.string(),
  content: z.string().min(1).max(5000),
  createdAt: z.string(),
});
export type DepartmentMemoryEntry = z.infer<typeof departmentMemoryEntrySchema>;

export const createDepartmentSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  leadUserId: z.string().nullable().optional(),
});
export type CreateDepartment = z.infer<typeof createDepartmentSchema>;

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  leadUserId: z.string().nullable().optional(),
  rules: z.string().max(10000).nullable().optional(),
  guidelines: z.string().max(10000).nullable().optional(),
  memory: z.array(departmentMemoryEntrySchema).nullable().optional(),
  mcpKeys: z.array(z.string()).nullable().optional(),
});
export type UpdateDepartment = z.infer<typeof updateDepartmentSchema>;

export const addDepartmentMemorySchema = z.object({
  content: z.string().min(1).max(5000),
});
export type AddDepartmentMemory = z.infer<typeof addDepartmentMemorySchema>;

export const assignAgentToDepartmentSchema = z.object({
  agentId: z.string().uuid(),
});
export type AssignAgentToDepartment = z.infer<typeof assignAgentToDepartmentSchema>;
