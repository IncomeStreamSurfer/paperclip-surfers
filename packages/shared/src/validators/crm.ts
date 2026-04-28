import { z } from "zod";

export const CRM_CONTACT_STATUSES = [
  "lead",
  "prospect",
  "customer",
  "churned",
  "archived",
] as const;

export const CRM_DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed-won",
  "closed-lost",
] as const;

export const CRM_DEAL_STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  "closed-won": "Closed Won",
  "closed-lost": "Closed Lost",
};

// ─── Contact schemas ──────────────────────────────────────────────────────────

export const createCrmContactSchema = z.object({
  firstName: z.string().min(1).max(200),
  lastName: z.string().max(200).default(""),
  email: z.string().email().max(500).optional().nullable(),
  phone: z.string().max(100).optional().nullable(),
  jobTitle: z.string().max(300).optional().nullable(),
  organization: z.string().max(300).optional().nullable(),
  status: z.enum(CRM_CONTACT_STATUSES).default("lead"),
  assignedAgentId: z.string().uuid().optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
});

export type CreateCrmContact = z.infer<typeof createCrmContactSchema>;

export const updateCrmContactSchema = createCrmContactSchema.partial();
export type UpdateCrmContact = z.infer<typeof updateCrmContactSchema>;

// ─── Deal schemas ─────────────────────────────────────────────────────────────

export const createCrmDealSchema = z.object({
  title: z.string().min(1).max(500),
  valueCents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().max(10).default("USD"),
  stage: z.enum(CRM_DEAL_STAGES).default("lead"),
  contactId: z.string().uuid().optional().nullable(),
  assignedAgentId: z.string().uuid().optional().nullable(),
  expectedCloseDate: z.string().datetime().optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
});

export type CreateCrmDeal = z.infer<typeof createCrmDealSchema>;

export const updateCrmDealSchema = createCrmDealSchema.partial();
export type UpdateCrmDeal = z.infer<typeof updateCrmDealSchema>;
