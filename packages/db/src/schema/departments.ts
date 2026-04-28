import { pgTable, uuid, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export type DepartmentMemoryEntry = { id: string; content: string; createdAt: string };

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    color: text("color"),
    leadUserId: text("lead_user_id"),
    rules: text("rules"),
    guidelines: text("guidelines"),
    memory: jsonb("memory").$type<DepartmentMemoryEntry[]>().default([]),
    mcpKeys: jsonb("mcp_keys").$type<string[]>().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("departments_company_idx").on(table.companyId),
    companyNameIdx: index("departments_company_name_idx").on(table.companyId, table.name),
  }),
);
