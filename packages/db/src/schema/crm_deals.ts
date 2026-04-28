import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { crmContacts } from "./crm_contacts.js";

export const CRM_DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed-won",
  "closed-lost",
] as const;

export const crmDeals = pgTable("crm_deals", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  // value stored as integer cents (e.g. 149900 = $1499.00); null = unknown
  valueCents: integer("value_cents"),
  currency: text("currency").notNull().default("USD"),
  stage: text("stage").notNull().default("lead"),
  contactId: text("contact_id").references(() => crmContacts.id, { onDelete: "set null" }),
  assignedAgentId: uuid("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
  expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
