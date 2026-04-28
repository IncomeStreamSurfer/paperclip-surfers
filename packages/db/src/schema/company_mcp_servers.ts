import { pgTable, uuid, text, timestamp, jsonb, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const companyMcpServers = pgTable(
  "company_mcp_servers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    description: text("description"),
    command: text("command").notNull(),
    args: jsonb("args").$type<string[]>().notNull().default([]),
    env: jsonb("env").$type<Record<string, string>>().notNull().default({}),
    transportType: text("transport_type").notNull().$type<"stdio" | "http" | "sse">(),
    transportUrl: text("transport_url"),
    source: text("source").notNull().$type<"claude_code_discovered" | "manual">(),
    claudeCodeConfigPath: text("claude_code_config_path"),
    scope: text("scope").notNull().$type<"company" | "agent">(),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("company_mcp_servers_company_idx").on(table.companyId),
    companyAgentIdx: index("company_mcp_servers_company_agent_idx").on(table.companyId, table.agentId),
    companyNameUniq: uniqueIndex("company_mcp_servers_company_name_uniq").on(table.companyId, table.name),
  }),
);

export const agentMcpExclusions = pgTable(
  "agent_mcp_exclusions",
  {
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    mcpServerId: uuid("mcp_server_id").notNull().references(() => companyMcpServers.id, { onDelete: "cascade" }),
  },
  (table) => ({
    primaryIdx: index("agent_mcp_exclusions_agent_mcp_idx").on(table.agentId, table.mcpServerId),
  }),
);
