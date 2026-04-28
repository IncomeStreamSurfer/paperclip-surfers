import { pgTable, uuid, text, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { projects } from "./projects.js";

export type SprintStatus = "planning" | "active" | "completed" | "cancelled";

export const sprints = pgTable(
  "sprints",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    goal: text("goal"),
    status: text("status").notNull().default("planning"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    /** AI-generated report stored as JSONB */
    aiReport: jsonb("ai_report").$type<{
      summary: string;
      velocity: number;
      completionRate: number;
      topAccomplishments: string[];
      risks: string[];
      recommendations: string[];
      generatedAt: string;
    }>(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    companyIdx: index("sprints_company_idx").on(t.companyId),
    projectIdx: index("sprints_project_idx").on(t.projectId),
  }),
);
