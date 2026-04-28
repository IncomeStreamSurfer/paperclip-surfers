import { pgTable, text, uuid, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { socialAccounts } from "./social_accounts.js";

export const socialPostStatusEnum = pgEnum("social_post_status", [
  "draft",
  "proposed",
  "approved",
  "scheduled",
  "published",
  "rejected",
]);

export interface SocialPostData {
  hashtags?: string[];
  mediaUrls?: string[];
  link?: string | null;
  altText?: string | null;
  agentId?: string | null;
}

export const socialPosts = pgTable("social_posts", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  accountId: text("account_id").references(() => socialAccounts.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  status: socialPostStatusEnum("status").notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  data: jsonb("data").$type<SocialPostData>(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
