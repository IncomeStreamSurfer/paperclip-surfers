import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const researchProjects = pgTable(
  "research_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    abstract: text("abstract"),
    domain: text("domain"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("research_projects_company_idx").on(t.companyId) }),
);

export const researchNotes = pgTable(
  "research_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => researchProjects.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    tags: text("tags"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("research_notes_company_idx").on(t.companyId) }),
);

export const researchLiterature = pgTable(
  "research_literature",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => researchProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    authors: text("authors"),
    year: text("year"),
    url: text("url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("research_literature_company_idx").on(t.companyId) }),
);
