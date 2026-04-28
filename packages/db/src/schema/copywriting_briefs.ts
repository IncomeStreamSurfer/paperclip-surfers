import { pgTable, text, uuid, timestamp, integer } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

// Content-type values for copywriting briefs
export const COPYWRITING_CONTENT_TYPES = [
  "blog-post",
  "article",
  "social-post",
  "email",
  "landing-page",
  "product-description",
  "press-release",
  "whitepaper",
  "case-study",
  "newsletter",
  "ad-copy",
  "other",
] as const;

export const COPYWRITING_BRIEF_STATUSES = [
  "draft",
  "in-progress",
  "review",
  "approved",
  "published",
] as const;

export const copywritingBriefs = pgTable("copywriting_briefs", {
  id: text("id").primaryKey(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  contentType: text("content_type").notNull().default("blog-post"),
  status: text("status").notNull().default("draft"),
  targetKeyword: text("target_keyword"),
  targetAudience: text("target_audience"),
  wordCountTarget: integer("word_count_target"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  assignedAgentId: uuid("assigned_agent_id").references(() => agents.id, { onDelete: "set null" }),
  brief: text("brief"),
  notes: text("notes"),
  generatedContent: text("generated_content"),
  generatedWordCount: integer("generated_word_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
