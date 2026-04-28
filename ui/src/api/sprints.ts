import { api } from "./client";
import type { Issue } from "@paperclipai/shared";

export interface Sprint {
  id: string;
  companyId: string;
  projectId: string | null;
  name: string;
  goal: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  aiReport: SprintAiReport | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SprintAiReport {
  summary: string;
  velocity: number;
  completionRate: number;
  topAccomplishments: string[];
  risks: string[];
  recommendations: string[];
  generatedAt: string;
}

export interface SprintVelocity {
  sprintId: string;
  totalIssues: number;
  completedIssues: number;
  completionRate: number;
  dailyRate: number | null;
  sprintDays: number | null;
}

export const sprintApi = {
  list: (companyId: string, projectId?: string): Promise<{ sprints: Sprint[] }> =>
    api.get(`/companies/${companyId}/sprints${projectId ? `?projectId=${projectId}` : ""}`),

  get: (companyId: string, id: string): Promise<Sprint> =>
    api.get(`/companies/${companyId}/sprints/${id}`),

  create: (
    companyId: string,
    data: {
      name: string;
      goal?: string | null;
      projectId?: string | null;
      status?: string;
      startDate?: string | null;
      endDate?: string | null;
    },
  ): Promise<Sprint> => api.post(`/companies/${companyId}/sprints`, data),

  update: (
    companyId: string,
    id: string,
    data: Partial<Omit<Sprint, "id" | "companyId" | "createdAt" | "updatedAt" | "aiReport">>,
  ): Promise<Sprint> => api.patch(`/companies/${companyId}/sprints/${id}`, data),

  delete: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/sprints/${id}`),

  velocity: (companyId: string, id: string): Promise<SprintVelocity> =>
    api.get(`/companies/${companyId}/sprints/${id}/velocity`),

  generateReport: (companyId: string, id: string): Promise<Sprint> =>
    api.post(`/companies/${companyId}/sprints/${id}/generate-report`, {}),

  listIssues: (companyId: string, id: string): Promise<{ issues: Issue[] }> =>
    api.get(`/companies/${companyId}/sprints/${id}/issues`),

  addIssue: (companyId: string, id: string, issueId: string): Promise<{ ok: boolean }> =>
    api.post(`/companies/${companyId}/sprints/${id}/issues`, { issueId }),

  removeIssue: (companyId: string, id: string, issueId: string): Promise<{ ok: boolean }> =>
    api.delete(`/companies/${companyId}/sprints/${id}/issues/${issueId}`),
};
