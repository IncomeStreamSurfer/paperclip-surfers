import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";

export const civilProjects = pgTable(
  "civil_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** e.g. residential, commercial, infrastructure, industrial */
    projectType: text("project_type").notNull().default("general"),
    /** planning | design | approval | construction | complete | on_hold */
    status: text("status").notNull().default("planning"),
    location: text("location"),
    clientName: text("client_name"),
    estimatedBudget: text("estimated_budget"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ companyIdx: index("civil_projects_company_idx").on(t.companyId) }),
);

export const civilDrawings = pgTable(
  "civil_drawings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => civilProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    drawingNumber: text("drawing_number"),
    /** plan | elevation | section | detail | site | structural | mep */
    drawingType: text("drawing_type").notNull().default("plan"),
    /** draft | in_review | approved | superseded */
    status: text("status").notNull().default("draft"),
    revision: text("revision").notNull().default("A"),
    discipline: text("discipline"),
    scale: text("scale"),
    fileUrl: text("file_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("civil_drawings_company_idx").on(t.companyId),
    projectIdx: index("civil_drawings_project_idx").on(t.projectId),
  }),
);

export const civilSpecifications = pgTable(
  "civil_specifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => civilProjects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** e.g. CSI division number */
    sectionNumber: text("section_number"),
    content: text("content"),
    /** draft | issued | superseded */
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("civil_specs_company_idx").on(t.companyId),
    projectIdx: index("civil_specs_project_idx").on(t.projectId),
  }),
);
