import { pgTable, uuid, text, timestamp, real, index, jsonb } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { departments } from "./departments.js";

export const agentMemories = pgTable(
  "agent_memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    scope: text("scope").notNull().$type<"global" | "project">(),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    category: text("category").notNull().$type<"pattern" | "preference" | "decision" | "learning" | "feedback">(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    source: text("source").notNull().$type<"self" | "ceo" | "board" | "human">(),
    confidence: real("confidence").notNull().default(0.5),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    sharedWith: jsonb("shared_with").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentScopeIdx: index("agent_memories_agent_scope_idx").on(table.agentId, table.scope),
    agentProjectIdx: index("agent_memories_agent_project_idx").on(table.agentId, table.projectId),
    companyIdx: index("agent_memories_company_idx").on(table.companyId),
    departmentIdx: index("agent_memories_dept_idx").on(table.departmentId),
  }),
);
