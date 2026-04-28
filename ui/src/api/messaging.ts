import {
  type MessagingProviderRow,
  type MessagingSubscription,
  type UpsertMessagingProvider,
  type UpsertMessagingSubscription,
} from "@paperclipai/shared";
import { api } from "./client";

export const messagingApi = {
  listProviders: (companyId: string) =>
    api.get<MessagingProviderRow[]>(`/companies/${companyId}/messaging/providers`),

  upsertProvider: (companyId: string, data: UpsertMessagingProvider) =>
    api.put<MessagingProviderRow>(`/companies/${companyId}/messaging/providers`, data),

  deleteProvider: (companyId: string, provider: string) =>
    api.delete<void>(`/companies/${companyId}/messaging/providers/${provider}`),

  listSubscriptions: (companyId: string) =>
    api.get<MessagingSubscription[]>(`/companies/${companyId}/messaging/subscriptions`),

  upsertSubscription: (companyId: string, data: UpsertMessagingSubscription) =>
    api.put<MessagingSubscription>(`/companies/${companyId}/messaging/subscriptions`, data),
};
