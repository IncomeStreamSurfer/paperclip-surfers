import { pgTable, uuid, primaryKey, index } from "drizzle-orm/pg-core";
import { agents } from "./agents.js";
import { departments } from "./departments.js";

export const agentDepartments = pgTable(
  "agent_departments",
  {
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ name: "agent_departments_pk", columns: [table.agentId, table.departmentId] }),
    departmentIdx: index("agent_departments_dept_idx").on(table.departmentId),
    agentIdx: index("agent_departments_agent_idx").on(table.agentId),
  }),
);
