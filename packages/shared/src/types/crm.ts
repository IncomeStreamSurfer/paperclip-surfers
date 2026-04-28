export type CrmContactStatus =
  | "lead"
  | "prospect"
  | "customer"
  | "churned"
  | "archived";

export type CrmDealStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "closed-won"
  | "closed-lost";

export interface CrmContact {
  id: string;
  companyId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  organization: string | null;
  status: CrmContactStatus;
  assignedAgentId: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CrmDeal {
  id: string;
  companyId: string;
  title: string;
  valueCents: number | null;
  currency: string;
  stage: CrmDealStage;
  contactId: string | null;
  assignedAgentId: string | null;
  expectedCloseDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
