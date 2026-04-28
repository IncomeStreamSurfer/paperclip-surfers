export type CopywritingContentType =
  | "blog-post"
  | "article"
  | "social-post"
  | "email"
  | "landing-page"
  | "product-description"
  | "press-release"
  | "whitepaper"
  | "case-study"
  | "newsletter"
  | "ad-copy"
  | "other";

export type CopywritingBriefStatus =
  | "draft"
  | "in-progress"
  | "review"
  | "approved"
  | "published";

export interface CopywritingBrief {
  id: string;
  companyId: string;
  title: string;
  contentType: CopywritingContentType;
  status: CopywritingBriefStatus;
  targetKeyword: string | null;
  targetAudience: string | null;
  wordCountTarget: number | null;
  dueDate: Date | null;
  assignedAgentId: string | null;
  brief: string | null;
  notes: string | null;
  generatedContent: string | null;
  generatedWordCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

