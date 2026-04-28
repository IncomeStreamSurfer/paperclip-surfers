import { api } from "./client";

export interface UserPreferences {
  timezone?: string;
  language?: string;
  notifications?: {
    emailOnBlocked?: boolean;
    emailOnMention?: boolean;
    emailOnAssigned?: boolean;
    emailDigest?: "none" | "daily" | "weekly";
  };
  security?: {
    loginTimeoutMinutes?: number | null;
  };
}

export interface UserProfile {
  userId: string;
  bio: string | null;
  phone: string | null;
  jobTitle: string | null;
  location: string | null;
  preferences: UserPreferences | null;
}

export interface UserProfileUpdate {
  bio?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  preferences?: UserPreferences | null;
}

export interface UserSessionInfo {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export const userProfileApi = {
  get: () => api.get<UserProfile>("/user/profile"),
  update: (data: UserProfileUpdate) => api.patch<UserProfile>("/user/profile", data),
  listSessions: () => api.get<{ sessions: UserSessionInfo[] }>("/user/sessions"),
  revokeSession: (id: string) => api.delete<{ ok: boolean }>(`/user/sessions/${id}`),
};
