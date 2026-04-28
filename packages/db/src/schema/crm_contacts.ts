import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const CRM_CONTACT_STATUSES = [
  "lead",
  "prospect",
  "customer",
  "churned",
  "archived",
] as const;

export const crmContacts = pgTable("crm_contacts", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull().default(""),
  email: text("email"),
  phone: text("phone"),
  jobTitle: text("job_title"),
  organization: text("organization"),
  status: text("status").notNull().default("lead"),
  assignedAgentId: uuid("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
