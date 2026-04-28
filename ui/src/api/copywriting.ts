import { api } from "./client";
import type { CopywritingBrief } from "@paperclipai/shared";

export type { CopywritingBrief };

export const copywritingApi = {
  listBriefs: (
    companyId: string,
    filters?: { status?: string; contentType?: string },
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.contentType) params.set("contentType", filters.contentType);
    const qs = params.toString();
    return api.get<CopywritingBrief[]>(
      `/companies/${companyId}/copywriting/briefs${qs ? `?${qs}` : ""}`,
    );
  },

  getBrief: (briefId: string) =>
    api.get<CopywritingBrief>(`/copywriting/briefs/${briefId}`),

  createBrief: (
    companyId: string,
    data: {
      title: string;
      contentType?: string;
      status?: string;
      targetKeyword?: string | null;
      targetAudience?: string | null;
      wordCountTarget?: number | null;
      dueDate?: string | null;
      assignedAgentId?: string | null;
      brief?: string | null;
      notes?: string | null;
    },
  ) =>
    api.post<CopywritingBrief>(
      `/companies/${companyId}/copywriting/briefs`,
      data,
    ),

  updateBrief: (
    briefId: string,
    data: Partial<{
      title: string;
      contentType: string;
      status: string;
      targetKeyword: string | null;
      targetAudience: string | null;
      wordCountTarget: number | null;
      dueDate: string | null;
      assignedAgentId: string | null;
      brief: string | null;
      notes: string | null;
      generatedContent: string | null;
      generatedWordCount: number | null;
    }>,
  ) => api.patch<CopywritingBrief>(`/copywriting/briefs/${briefId}`, data),

  deleteBrief: (briefId: string) =>
    api.delete<void>(`/copywriting/briefs/${briefId}`),

  generateContent: (briefId: string) =>
    api.post<CopywritingBrief>(`/copywriting/briefs/${briefId}/generate`, {}),
};
