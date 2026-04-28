import { api } from "./client";

export interface TeamMember {
  userId: string;
  role: string;
  createdAt: string;
  name: string | null;
  email: string | null;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface InviteDetails {
  email: string;
  role: string;
  companyName: string | null;
  expiresAt: string;
}

export const teamApi = {
  listMembers: (companyId: string): Promise<{ members: TeamMember[] }> =>
    api.get<{ members: TeamMember[] }>(`/companies/${companyId}/team`),

  listInvitations: (companyId: string): Promise<{ invitations: PendingInvitation[] }> =>
    api.get<{ invitations: PendingInvitation[] }>(`/companies/${companyId}/team/invitations`),

  inviteUser: (
    companyId: string,
    email: string,
    role: string,
  ): Promise<{ invitation: PendingInvitation & { token: string; acceptLink: string } }> =>
    api.post<{ invitation: PendingInvitation & { token: string; acceptLink: string } }>(
      `/companies/${companyId}/team/invite`,
      { email, role },
    ),

  updateRole: (
    companyId: string,
    userId: string,
    role: string,
  ): Promise<{ member: TeamMember }> =>
    api.patch<{ member: TeamMember }>(`/companies/${companyId}/team/${userId}/role`, { role }),

  removeMember: (companyId: string, userId: string): Promise<{ ok: boolean }> =>
    api.delete<{ ok: boolean }>(`/companies/${companyId}/team/${userId}`),

  revokeInvitation: (companyId: string, invitationId: string): Promise<{ ok: boolean }> =>
    api.delete<{ ok: boolean }>(`/companies/${companyId}/team/invitations/${invitationId}`),

  getInviteDetails: (token: string): Promise<{ invitation: InviteDetails }> =>
    api.get<{ invitation: InviteDetails }>(`/user-invitations/${token}`),

  claimInvite: (
    token: string,
  ): Promise<{ ok: boolean; companyId: string; issuePrefix: string | null; role: string }> =>
    api.post<{ ok: boolean; companyId: string; issuePrefix: string | null; role: string }>(
      `/user-invitations/${token}/claim`,
      {},
    ),
};
