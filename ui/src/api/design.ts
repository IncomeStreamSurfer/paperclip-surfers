import { api } from "./client";
import type { DesignAsset } from "@paperclipai/shared";

export type { DesignAsset };

export const designApi = {
  // ── List ─────────────────────────────────────────────────────────────────

  listAssets: (
    companyId: string,
    filters?: { status?: string; style?: string; limit?: number; offset?: number },
  ) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.style) params.set("style", filters.style);
    if (filters?.limit != null) params.set("limit", String(filters.limit));
    if (filters?.offset != null) params.set("offset", String(filters.offset));
    const qs = params.toString();
    return api.get<DesignAsset[]>(`/companies/${companyId}/design/assets${qs ? `?${qs}` : ""}`);
  },

  getAsset: (assetId: string) =>
    api.get<DesignAsset>(`/design/assets/${assetId}`),

  getStats: (companyId: string) =>
    api.get<Record<string, number>>(`/companies/${companyId}/design/stats`),

  // ── Expand prompt ─────────────────────────────────────────────────────────

  expandPrompt: (
    companyId: string,
    data: { description: string; style: string },
  ) => api.post<{ prompt: string }>(`/companies/${companyId}/design/assets/expand-prompt`, data),

  // ── Generate ──────────────────────────────────────────────────────────────

  generateAsset: (
    companyId: string,
    data: {
      title: string;
      prompt: string;
      style: string;
      aspectRatio: string;
      seed?: number;
      temperature: number;
      expandPrompt: boolean;
    },
  ) => api.post<DesignAsset>(`/companies/${companyId}/design/assets/generate`, data),

  // ── Update ────────────────────────────────────────────────────────────────

  updateAsset: (
    assetId: string,
    data: { title?: string; notes?: string | null },
  ) => api.patch<DesignAsset>(`/design/assets/${assetId}`, data),

  // ── Delete ────────────────────────────────────────────────────────────────

  deleteAsset: (assetId: string) =>
    api.delete<void>(`/design/assets/${assetId}`),
};
