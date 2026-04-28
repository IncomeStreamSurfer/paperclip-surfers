import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const userCompanyRoles = pgTable(
  "user_company_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").notNull(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCompanyUniq: uniqueIndex("user_company_roles_user_company_uniq").on(table.userId, table.companyId),
    companyIdx: index("user_company_roles_company_idx").on(table.companyId),
    userIdx: index("user_company_roles_user_idx").on(table.userId),
  }),
);
