export type SeoPageStatus = "draft" | "published" | "needs-work";

export interface SeoKeyword {
  id: string;
  companyId: string;
  keyword: string;
  targetUrl: string | null;
  searchVolume: number | null;
  difficulty: number | null;
  currentRank: number | null;
  targetRank: number | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SeoPage {
  id: string;
  companyId: string;
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  focusKeyword: string | null;
  seoScore: number | null;
  status: SeoPageStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
