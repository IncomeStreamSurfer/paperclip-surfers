import { z } from "zod";

export const MSP_CLIENT_STATUSES = ["active", "inactive", "churned"] as const;
export const MSP_CLIENT_TIERS = ["basic", "standard", "premium", "enterprise"] as const;
export const MSP_TICKET_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export const MSP_TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;

export const createMspClientSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(253).nullable().optional(),
  status: z.enum(MSP_CLIENT_STATUSES).optional().default("active"),
  tier: z.enum(MSP_CLIENT_TIERS).optional().default("standard"),
  contactName: z.string().max(200).nullable().optional(),
  contactEmail: z.string().email().max(254).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});
export type CreateMspClient = z.infer<typeof createMspClientSchema>;
export const updateMspClientSchema = createMspClientSchema.partial();
export type UpdateMspClient = z.infer<typeof updateMspClientSchema>;

export const createMspTicketSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(20000).nullable().optional(),
  clientId: z.string().uuid().nullable().optional(),
  status: z.enum(MSP_TICKET_STATUSES).optional().default("open"),
  priority: z.enum(MSP_TICKET_PRIORITIES).optional().default("medium"),
});
export type CreateMspTicket = z.infer<typeof createMspTicketSchema>;
export const updateMspTicketSchema = createMspTicketSchema.partial().extend({
  resolvedAt: z.string().datetime().nullable().optional(),
});
export type UpdateMspTicket = z.infer<typeof updateMspTicketSchema>;
