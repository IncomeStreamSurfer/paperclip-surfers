import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const seoKeywords = pgTable("seo_keywords", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  keyword: text("keyword").notNull(),
  targetUrl: text("target_url"),
  searchVolume: integer("search_volume"),
  difficulty: integer("difficulty"),      // 0–100
  currentRank: integer("current_rank"),
  targetRank: integer("target_rank"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
