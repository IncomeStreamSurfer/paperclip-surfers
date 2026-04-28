import { api } from "./client";
import type { SocialAccount, SocialPost } from "@paperclipai/shared";

export type { SocialAccount, SocialPost };

export const socialMediaApi = {
  // Accounts
  listAccounts: (companyId: string) =>
    api.get<SocialAccount[]>(`/companies/${companyId}/social-media/accounts`),

  createAccount: (
    companyId: string,
    data: { platform: string; handle: string; displayName?: string | null; profileImageUrl?: string | null; notes?: string | null },
  ) => api.post<SocialAccount>(`/companies/${companyId}/social-media/accounts`, data),

  updateAccount: (
    accountId: string,
    data: Partial<{ platform: string; handle: string; displayName: string | null; profileImageUrl: string | null; notes: string | null; status: string }>,
  ) => api.patch<SocialAccount>(`/social-media/accounts/${accountId}`, data),

  deleteAccount: (accountId: string) =>
    api.delete<void>(`/social-media/accounts/${accountId}`),

  // Posts
  listPosts: (companyId: string, filters?: { status?: string; accountId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    if (filters?.accountId) params.set("accountId", filters.accountId);
    const qs = params.toString();
    return api.get<SocialPost[]>(`/companies/${companyId}/social-media/posts${qs ? `?${qs}` : ""}`);
  },

  getPost: (postId: string) =>
    api.get<SocialPost>(`/social-media/posts/${postId}`),

  createPost: (
    companyId: string,
    data: {
      title: string;
      body?: string;
      accountId?: string | null;
      status?: string;
      scheduledAt?: string | null;
      data?: { hashtags?: string[]; mediaUrls?: string[]; link?: string | null } | null;
    },
  ) => api.post<SocialPost>(`/companies/${companyId}/social-media/posts`, data),

  updatePost: (
    postId: string,
    data: {
      title?: string;
      body?: string;
      accountId?: string | null;
      status?: string;
      scheduledAt?: string | null;
      data?: { hashtags?: string[]; mediaUrls?: string[]; link?: string | null } | null;
    },
  ) => api.patch<SocialPost>(`/social-media/posts/${postId}`, data),

  deletePost: (postId: string) =>
    api.delete<void>(`/social-media/posts/${postId}`),
};
