import { api } from "./client";

export interface DepartmentMemoryEntry {
  id: string;
  content: string;
  createdAt: string;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  color: string | null;
  leadUserId: string | null;
  rules: string | null;
  guidelines: string | null;
  memory: DepartmentMemoryEntry[] | null;
  mcpKeys: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentWithAgents extends Department {
  agents: Array<{ agentId: string; name: string; status: string }>;
}

export type DepartmentDetail = DepartmentWithAgents;

export const departmentsApi = {
  list: (companyId: string, withAgents?: boolean): Promise<{ departments: Department[] | DepartmentWithAgents[] }> =>
    api.get(`/companies/${companyId}/departments${withAgents ? "?withAgents=true" : ""}`),

  get: (companyId: string, departmentId: string): Promise<DepartmentDetail> =>
    api.get(`/companies/${companyId}/departments/${departmentId}`),

  create: (
    companyId: string,
    data: { name: string; description?: string | null; color?: string | null; leadUserId?: string | null },
  ): Promise<Department> =>
    api.post(`/companies/${companyId}/departments`, data),

  update: (
    companyId: string,
    departmentId: string,
    data: {
      name?: string;
      description?: string | null;
      color?: string | null;
      leadUserId?: string | null;
      rules?: string | null;
      guidelines?: string | null;
      memory?: DepartmentMemoryEntry[] | null;
      mcpKeys?: string[] | null;
    },
  ): Promise<Department> =>
    api.patch(`/companies/${companyId}/departments/${departmentId}`, data),

  delete: (companyId: string, departmentId: string): Promise<void> =>
    api.delete(`/companies/${companyId}/departments/${departmentId}`),

  addAgent: (companyId: string, departmentId: string, agentId: string): Promise<void> =>
    api.post(`/companies/${companyId}/departments/${departmentId}/agents`, { agentId }),

  removeAgent: (companyId: string, departmentId: string, agentId: string): Promise<void> =>
    api.delete(`/companies/${companyId}/departments/${departmentId}/agents/${agentId}`),

  addMemory: (companyId: string, departmentId: string, content: string): Promise<DepartmentMemoryEntry> =>
    api.post(`/companies/${companyId}/departments/${departmentId}/memory`, { content }),

  removeMemory: (companyId: string, departmentId: string, entryId: string): Promise<void> =>
    api.delete(`/companies/${companyId}/departments/${departmentId}/memory/${entryId}`),
};
