import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { crmContacts, crmDeals } from "@paperclipai/db";
import { eq, and, desc } from "drizzle-orm";
import type { CreateCrmContact, UpdateCrmContact, CreateCrmDeal, UpdateCrmDeal } from "@paperclipai/shared";

export function crmService(db: Db) {
  return {
    // ── Contacts ────────────────────────────────────────────────────────────

    listContacts: (companyId: string, filters?: { status?: string }) => {
      const conditions = [eq(crmContacts.companyId, companyId)];
      if (filters?.status) {
        conditions.push(
          eq(crmContacts.status, filters.status as typeof crmContacts.status._.data),
        );
      }
      return db
        .select()
        .from(crmContacts)
        .where(and(...conditions))
        .orderBy(desc(crmContacts.updatedAt));
    },

    getContactById: (id: string) =>
      db
        .select()
        .from(crmContacts)
        .where(eq(crmContacts.id, id))
        .then((rows) => rows[0] ?? null),

    createContact: (companyId: string, data: CreateCrmContact) => {
      const now = new Date();
      return db
        .insert(crmContacts)
        .values({
          id: randomUUID(),
          companyId,
          firstName: data.firstName,
          lastName: data.lastName ?? "",
          email: data.email ?? null,
          phone: data.phone ?? null,
          jobTitle: data.jobTitle ?? null,
          organization: data.organization ?? null,
          status: data.status ?? "lead",
          assignedAgentId: data.assignedAgentId ?? null,
          notes: data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updateContact: (id: string, data: UpdateCrmContact) =>
      db
        .update(crmContacts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(crmContacts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deleteContact: (id: string) =>
      db
        .delete(crmContacts)
        .where(eq(crmContacts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ── Deals ────────────────────────────────────────────────────────────────

    listDeals: (companyId: string, filters?: { stage?: string; contactId?: string }) => {
      const conditions = [eq(crmDeals.companyId, companyId)];
      if (filters?.stage) {
        conditions.push(
          eq(crmDeals.stage, filters.stage as typeof crmDeals.stage._.data),
        );
      }
      if (filters?.contactId) {
        conditions.push(
          eq(crmDeals.contactId, filters.contactId),
        );
      }
      return db
        .select()
        .from(crmDeals)
        .where(and(...conditions))
        .orderBy(desc(crmDeals.updatedAt));
    },

    getDealById: (id: string) =>
      db
        .select()
        .from(crmDeals)
        .where(eq(crmDeals.id, id))
        .then((rows) => rows[0] ?? null),

    createDeal: (companyId: string, data: CreateCrmDeal) => {
      const now = new Date();
      return db
        .insert(crmDeals)
        .values({
          id: randomUUID(),
          companyId,
          title: data.title,
          valueCents: data.valueCents ?? null,
          currency: data.currency ?? "USD",
          stage: data.stage ?? "lead",
          contactId: data.contactId ?? null,
          assignedAgentId: data.assignedAgentId ?? null,
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          notes: data.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updateDeal: (id: string, data: UpdateCrmDeal) => {
      const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (data.expectedCloseDate !== undefined) {
        patch.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
      }
      return db
        .update(crmDeals)
        .set(patch)
        .where(eq(crmDeals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    deleteDeal: (id: string) =>
      db
        .delete(crmDeals)
        .where(eq(crmDeals.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
