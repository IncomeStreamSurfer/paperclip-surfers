import { api } from "./client";

export interface CivilProject {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  projectType: string;
  status: string;
  location: string | null;
  clientName: string | null;
  estimatedBudget: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CivilDrawing {
  id: string;
  companyId: string;
  projectId: string | null;
  title: string;
  drawingNumber: string | null;
  drawingType: string;
  status: string;
  revision: string;
  discipline: string | null;
  scale: string | null;
  fileUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CivilSpecification {
  id: string;
  companyId: string;
  projectId: string | null;
  title: string;
  sectionNumber: string | null;
  content: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export const civilApi = {
  listProjects: (companyId: string): Promise<{ projects: CivilProject[] }> =>
    api.get(`/companies/${companyId}/civil/projects`),

  getProject: (companyId: string, id: string): Promise<CivilProject> =>
    api.get(`/companies/${companyId}/civil/projects/${id}`),

  createProject: (
    companyId: string,
    data: Partial<Omit<CivilProject, "id" | "companyId" | "createdAt" | "updatedAt">> & { name: string },
  ): Promise<CivilProject> => api.post(`/companies/${companyId}/civil/projects`, data),

  updateProject: (
    companyId: string,
    id: string,
    data: Partial<Omit<CivilProject, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<CivilProject> => api.patch(`/companies/${companyId}/civil/projects/${id}`, data),

  deleteProject: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/civil/projects/${id}`),

  listDrawings: (companyId: string, projectId?: string): Promise<{ drawings: CivilDrawing[] }> =>
    api.get(`/companies/${companyId}/civil/drawings${projectId ? `?projectId=${projectId}` : ""}`),

  createDrawing: (
    companyId: string,
    data: Partial<Omit<CivilDrawing, "id" | "companyId" | "createdAt" | "updatedAt">> & { title: string },
  ): Promise<CivilDrawing> => api.post(`/companies/${companyId}/civil/drawings`, data),

  updateDrawing: (
    companyId: string,
    id: string,
    data: Partial<Omit<CivilDrawing, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<CivilDrawing> => api.patch(`/companies/${companyId}/civil/drawings/${id}`, data),

  deleteDrawing: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/civil/drawings/${id}`),

  listSpecs: (companyId: string, projectId?: string): Promise<{ specs: CivilSpecification[] }> =>
    api.get(`/companies/${companyId}/civil/specs${projectId ? `?projectId=${projectId}` : ""}`),

  createSpec: (
    companyId: string,
    data: Partial<Omit<CivilSpecification, "id" | "companyId" | "createdAt" | "updatedAt">> & { title: string },
  ): Promise<CivilSpecification> => api.post(`/companies/${companyId}/civil/specs`, data),

  updateSpec: (
    companyId: string,
    id: string,
    data: Partial<Omit<CivilSpecification, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<CivilSpecification> => api.patch(`/companies/${companyId}/civil/specs/${id}`, data),

  deleteSpec: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/civil/specs/${id}`),
};
