import { pgTable, text, uuid, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const socialPlatformEnum = pgEnum("social_platform", [
  "twitter",
  "linkedin",
  "instagram",
  "tiktok",
  "facebook",
  "youtube",
  "pinterest",
  "threads",
]);

export const socialAccountStatusEnum = pgEnum("social_account_status", [
  "active",
  "disconnected",
  "error",
]);

export const socialAccounts = pgTable("social_accounts", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  platform: socialPlatformEnum("platform").notNull(),
  handle: text("handle").notNull(),
  displayName: text("display_name"),
  profileImageUrl: text("profile_image_url"),
  accessTokenEnc: text("access_token_enc"),
  status: socialAccountStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
