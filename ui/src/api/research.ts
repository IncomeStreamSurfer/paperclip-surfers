import { api } from "./client";

export interface ResearchProject {
  id: string;
  companyId: string;
  title: string;
  abstract: string | null;
  domain: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchNote {
  id: string;
  companyId: string;
  projectId: string | null;
  content: string;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchLiterature {
  id: string;
  companyId: string;
  projectId: string | null;
  title: string;
  authors: string | null;
  year: string | null;
  url: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const researchApi = {
  listProjects: (companyId: string): Promise<{ projects: ResearchProject[] }> =>
    api.get(`/companies/${companyId}/research/projects`),

  getProject: (companyId: string, id: string): Promise<ResearchProject> =>
    api.get(`/companies/${companyId}/research/projects/${id}`),

  createProject: (
    companyId: string,
    data: { title: string; abstract?: string | null; domain?: string | null; status?: string },
  ): Promise<ResearchProject> =>
    api.post(`/companies/${companyId}/research/projects`, data),

  updateProject: (
    companyId: string,
    id: string,
    data: { title?: string; abstract?: string | null; domain?: string | null; status?: string },
  ): Promise<ResearchProject> =>
    api.patch(`/companies/${companyId}/research/projects/${id}`, data),

  deleteProject: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/research/projects/${id}`),

  listNotes: (companyId: string, projectId?: string): Promise<{ notes: ResearchNote[] }> =>
    api.get(`/companies/${companyId}/research/notes${projectId ? `?projectId=${projectId}` : ""}`),

  createNote: (
    companyId: string,
    data: { content: string; projectId?: string | null; tags?: string | null },
  ): Promise<ResearchNote> =>
    api.post(`/companies/${companyId}/research/notes`, data),

  updateNote: (
    companyId: string,
    id: string,
    data: { content?: string; tags?: string | null },
  ): Promise<ResearchNote> =>
    api.patch(`/companies/${companyId}/research/notes/${id}`, data),

  deleteNote: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/research/notes/${id}`),

  listLiterature: (companyId: string, projectId?: string): Promise<{ literature: ResearchLiterature[] }> =>
    api.get(
      `/companies/${companyId}/research/literature${projectId ? `?projectId=${projectId}` : ""}`,
    ),

  createLiterature: (
    companyId: string,
    data: {
      title: string;
      authors?: string | null;
      year?: string | null;
      url?: string | null;
      notes?: string | null;
      projectId?: string | null;
    },
  ): Promise<ResearchLiterature> =>
    api.post(`/companies/${companyId}/research/literature`, data),

  deleteLiterature: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/research/literature/${id}`),

  updateLiterature: (
    companyId: string,
    id: string,
    data: {
      title?: string;
      authors?: string | null;
      year?: string | null;
      url?: string | null;
      notes?: string | null;
      projectId?: string | null;
    },
  ): Promise<ResearchLiterature> =>
    api.patch(`/companies/${companyId}/research/literature/${id}`, data),
};
