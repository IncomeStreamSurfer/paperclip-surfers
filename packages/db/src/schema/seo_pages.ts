import { pgTable, text, uuid, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const seoPageStatusEnum = pgEnum("seo_page_status", [
  "draft",
  "published",
  "needs-work",
]);

export const seoPages = pgTable("seo_pages", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title"),
  metaDescription: text("meta_description"),
  h1: text("h1"),
  focusKeyword: text("focus_keyword"),
  seoScore: integer("seo_score"),         // 0–100
  status: seoPageStatusEnum("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
