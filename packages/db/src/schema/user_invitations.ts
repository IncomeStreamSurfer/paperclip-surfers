import { pgTable, uuid, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const userInvitations = pgTable(
  "user_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    token: uuid("token").notNull().defaultRandom(),
    invitedByUserId: text("invited_by_user_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenUniq: uniqueIndex("user_invitations_token_uniq").on(table.token),
    companyEmailIdx: index("user_invitations_company_email_idx").on(table.companyId, table.email),
    companyActiveIdx: index("user_invitations_company_active_idx").on(table.companyId, table.acceptedAt, table.revokedAt),
  }),
);
