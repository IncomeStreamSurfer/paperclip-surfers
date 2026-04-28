import { api } from "./client";
import type {
  KnowledgeBase,
  KnowledgeDocument,
  CreateKnowledgeBase,
  UpdateKnowledgeBase,
  KbQuery,
  KbQueryResult,
} from "@paperclipai/shared";

export const knowledgeApi = {
  listBases: (companyId: string) => api.get<KnowledgeBase[]>(`/companies/${companyId}/knowledge-bases`),

  createBase: (companyId: string, body: CreateKnowledgeBase) =>
    api.post<KnowledgeBase>(`/companies/${companyId}/knowledge-bases`, body),

  updateBase: (companyId: string, kbId: string, body: UpdateKnowledgeBase) =>
    api.patch<KnowledgeBase>(`/companies/${companyId}/knowledge-bases/${kbId}`, body),

  deleteBase: (companyId: string, kbId: string) =>
    api.delete<undefined>(`/companies/${companyId}/knowledge-bases/${kbId}`),

  listDocuments: (companyId: string, kbId: string) =>
    api.get<KnowledgeDocument[]>(`/companies/${companyId}/knowledge-bases/${kbId}/documents`),

  createDocument: (companyId: string, kbId: string, body: { filename: string; fileSize?: number; content?: string }) =>
    api.post<KnowledgeDocument>(`/companies/${companyId}/knowledge-bases/${kbId}/documents`, body),

  deleteDocument: (companyId: string, kbId: string, docId: string) =>
    api.delete<undefined>(`/companies/${companyId}/knowledge-bases/${kbId}/documents/${docId}`),

  query: (companyId: string, kbId: string, body: KbQuery) =>
    api.post<{ results: KbQueryResult[] }>(`/companies/${companyId}/knowledge-bases/${kbId}/query`, body),

  listAgentKbs: (companyId: string, agentId: string) =>
    api.get<Array<{ id: string; agentId: string; kbId: string; priority: number; createdAt: string; kbName: string }>>(
      `/companies/${companyId}/agents/${agentId}/knowledge-bases`,
    ),

  setAgentKbs: (companyId: string, agentId: string, kbIds: string[]) =>
    api.put<undefined>(`/companies/${companyId}/agents/${agentId}/knowledge-bases`, { kbIds }),
};
