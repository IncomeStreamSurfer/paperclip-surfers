import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { projects } from "./projects.js";
import { issues } from "./issues.js";

export const memoryBindings = pgTable(
  "memory_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "cascade" }),
    scope: text("scope").notNull().$type<"company" | "agent" | "project" | "issue">(),
    providerKind: text("provider_kind").notNull().$type<"chroma" | "markdown">(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdIdx: index("memory_bindings_company_id_idx").on(table.companyId),
    agentIdIdx: index("memory_bindings_agent_id_idx").on(table.agentId),
    scopeIdx: index("memory_bindings_scope_idx").on(table.scope),
  }),
);

export const memoryOperations = pgTable(
  "memory_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bindingId: uuid("binding_id").notNull().references(() => memoryBindings.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    runId: uuid("run_id"),
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    op: text("op").notNull().$type<"write" | "query" | "forget" | "browse" | "correct">(),
    queryText: text("query_text"),
    tokensUsed: integer("tokens_used"),
    latencyMs: integer("latency_ms"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    bindingIdIdx: index("memory_operations_binding_id_idx").on(table.bindingId),
    companyIdIdx: index("memory_operations_company_id_idx").on(table.companyId),
    agentIdIdx: index("memory_operations_agent_id_idx").on(table.agentId),
    runIdIdx: index("memory_operations_run_id_idx").on(table.runId),
    createdAtIdx: index("memory_operations_created_at_idx").on(table.createdAt),
  }),
);
