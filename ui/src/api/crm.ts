import { api } from "./client";
import type { CrmContact, CrmDeal } from "@paperclipai/shared";

export type { CrmContact, CrmDeal };

export const crmApi = {
  // ── Contacts ───────────────────────────────────────────────────────────────

  listContacts: (companyId: string, filters?: { status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return api.get<CrmContact[]>(`/companies/${companyId}/crm/contacts${qs ? `?${qs}` : ""}`);
  },

  getContact: (contactId: string) =>
    api.get<CrmContact>(`/crm/contacts/${contactId}`),

  createContact: (
    companyId: string,
    data: {
      firstName: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
      jobTitle?: string | null;
      organization?: string | null;
      status?: string;
      assignedAgentId?: string | null;
      notes?: string | null;
    },
  ) => api.post<CrmContact>(`/companies/${companyId}/crm/contacts`, data),

  updateContact: (
    contactId: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
      jobTitle: string | null;
      organization: string | null;
      status: string;
      assignedAgentId: string | null;
      notes: string | null;
    }>,
  ) => api.patch<CrmContact>(`/crm/contacts/${contactId}`, data),

  deleteContact: (contactId: string) =>
    api.delete<void>(`/crm/contacts/${contactId}`),

  // ── Deals ──────────────────────────────────────────────────────────────────

  listDeals: (companyId: string, filters?: { stage?: string; contactId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.stage) params.set("stage", filters.stage);
    if (filters?.contactId) params.set("contactId", filters.contactId);
    const qs = params.toString();
    return api.get<CrmDeal[]>(`/companies/${companyId}/crm/deals${qs ? `?${qs}` : ""}`);
  },

  getDeal: (dealId: string) =>
    api.get<CrmDeal>(`/crm/deals/${dealId}`),

  createDeal: (
    companyId: string,
    data: {
      title: string;
      valueCents?: number | null;
      currency?: string;
      stage?: string;
      contactId?: string | null;
      assignedAgentId?: string | null;
      expectedCloseDate?: string | null;
      notes?: string | null;
    },
  ) => api.post<CrmDeal>(`/companies/${companyId}/crm/deals`, data),

  updateDeal: (
    dealId: string,
    data: Partial<{
      title: string;
      valueCents: number | null;
      currency: string;
      stage: string;
      contactId: string | null;
      assignedAgentId: string | null;
      expectedCloseDate: string | null;
      notes: string | null;
    }>,
  ) => api.patch<CrmDeal>(`/crm/deals/${dealId}`, data),

  deleteDeal: (dealId: string) =>
    api.delete<void>(`/crm/deals/${dealId}`),
};
