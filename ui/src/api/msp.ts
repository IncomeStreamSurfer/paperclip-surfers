import { api } from "./client";

export interface MspClient {
  id: string;
  companyId: string;
  name: string;
  domain: string | null;
  status: string;
  tier: string;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MspTicket {
  id: string;
  companyId: string;
  clientId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const mspApi = {
  listClients: (companyId: string): Promise<{ clients: MspClient[] }> =>
    api.get(`/companies/${companyId}/msp/clients`),

  getClient: (companyId: string, id: string): Promise<MspClient> =>
    api.get(`/companies/${companyId}/msp/clients/${id}`),

  createClient: (
    companyId: string,
    data: {
      name: string;
      domain?: string | null;
      status?: string;
      tier?: string;
      contactName?: string | null;
      contactEmail?: string | null;
      notes?: string | null;
    },
  ): Promise<MspClient> =>
    api.post(`/companies/${companyId}/msp/clients`, data),

  updateClient: (
    companyId: string,
    id: string,
    data: Partial<Omit<MspClient, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<MspClient> =>
    api.patch(`/companies/${companyId}/msp/clients/${id}`, data),

  deleteClient: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/msp/clients/${id}`),

  listTickets: (companyId: string, clientId?: string): Promise<{ tickets: MspTicket[] }> =>
    api.get(`/companies/${companyId}/msp/tickets${clientId ? `?clientId=${clientId}` : ""}`),

  createTicket: (
    companyId: string,
    data: {
      title: string;
      description?: string | null;
      clientId?: string | null;
      status?: string;
      priority?: string;
    },
  ): Promise<MspTicket> =>
    api.post(`/companies/${companyId}/msp/tickets`, data),

  updateTicket: (
    companyId: string,
    id: string,
    data: Partial<Omit<MspTicket, "id" | "companyId" | "createdAt" | "updatedAt">>,
  ): Promise<MspTicket> =>
    api.patch(`/companies/${companyId}/msp/tickets/${id}`, data),

  deleteTicket: (companyId: string, id: string): Promise<void> =>
    api.delete(`/companies/${companyId}/msp/tickets/${id}`),
};
