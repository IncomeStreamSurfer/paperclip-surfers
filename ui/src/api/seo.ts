import { api } from "./client";
import type { SeoKeyword, SeoPage } from "@paperclipai/shared";

export type { SeoKeyword, SeoPage };

export const seoApi = {
  // Keywords
  listKeywords: (companyId: string) =>
    api.get<SeoKeyword[]>(`/companies/${companyId}/seo/keywords`),

  createKeyword: (
    companyId: string,
    data: {
      keyword: string;
      targetUrl?: string | null;
      searchVolume?: number | null;
      difficulty?: number | null;
      currentRank?: number | null;
      targetRank?: number | null;
      notes?: string | null;
    },
  ) => api.post<SeoKeyword>(`/companies/${companyId}/seo/keywords`, data),

  updateKeyword: (
    keywordId: string,
    data: Partial<{
      keyword: string;
      targetUrl: string | null;
      searchVolume: number | null;
      difficulty: number | null;
      currentRank: number | null;
      targetRank: number | null;
      notes: string | null;
    }>,
  ) => api.patch<SeoKeyword>(`/seo/keywords/${keywordId}`, data),

  deleteKeyword: (keywordId: string) =>
    api.delete<void>(`/seo/keywords/${keywordId}`),

  // Pages
  listPages: (companyId: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return api.get<SeoPage[]>(`/companies/${companyId}/seo/pages${qs ? `?${qs}` : ""}`);
  },

  getPage: (pageId: string) =>
    api.get<SeoPage>(`/seo/pages/${pageId}`),

  createPage: (
    companyId: string,
    data: {
      url: string;
      title?: string | null;
      metaDescription?: string | null;
      h1?: string | null;
      focusKeyword?: string | null;
      seoScore?: number | null;
      status?: string;
      notes?: string | null;
    },
  ) => api.post<SeoPage>(`/companies/${companyId}/seo/pages`, data),

  updatePage: (
    pageId: string,
    data: Partial<{
      url: string;
      title: string | null;
      metaDescription: string | null;
      h1: string | null;
      focusKeyword: string | null;
      seoScore: number | null;
      status: string;
      notes: string | null;
    }>,
  ) => api.patch<SeoPage>(`/seo/pages/${pageId}`, data),

  deletePage: (pageId: string) =>
    api.delete<void>(`/seo/pages/${pageId}`),
};
