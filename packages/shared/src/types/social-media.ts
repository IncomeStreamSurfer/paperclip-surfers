export type SocialPlatform =
  | "twitter"
  | "linkedin"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "youtube"
  | "pinterest"
  | "threads";

export type SocialAccountStatus = "active" | "disconnected" | "error";

export type SocialPostStatus =
  | "draft"
  | "proposed"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected";

export interface SocialPostData {
  hashtags?: string[];
  mediaUrls?: string[];
  link?: string | null;
  altText?: string | null;
  agentId?: string | null;
}

export interface SocialAccount {
  id: string;
  companyId: string;
  platform: SocialPlatform;
  handle: string;
  displayName: string | null;
  profileImageUrl: string | null;
  status: SocialAccountStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SocialPost {
  id: string;
  companyId: string;
  accountId: string | null;
  title: string;
  body: string;
  status: SocialPostStatus;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  data: SocialPostData | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // joined
  account?: Pick<SocialAccount, "platform" | "handle" | "displayName" | "profileImageUrl"> | null;
}
