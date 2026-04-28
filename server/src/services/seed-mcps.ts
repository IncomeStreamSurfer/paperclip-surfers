/**
 * Seed default MCP servers for a newly created company.
 *
 * Ships the most universally useful MCPs so they are ready to use without
 * any manual configuration. Only inserts if no company-scoped MCP servers
 * exist yet for that company (idempotent).
 */
import type { Db } from "@paperclipai/db";
import { companyMcpServers } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";

interface DefaultMcp {
  name: string;
  description: string;
  transportType: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
}

const DEFAULT_MCPS: DefaultMcp[] = [
  {
    name: "Web Fetch",
    description: "Fetch and extract content from web URLs — useful for research and link checking.",
    transportType: "stdio",
    command: "mcp-fetch",
    args: [],
  },
  {
    name: "Filesystem (Code Workspace)",
    description: "Read/write access to /workspace/code for code-related tasks.",
    transportType: "stdio",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/workspace/code"],
  },
];

export async function seedDefaultMcps(db: Db, companyId: string): Promise<void> {
  // Check if this company already has any company-scoped MCP servers
  const existing = await db
    .select({ id: companyMcpServers.id })
    .from(companyMcpServers)
    .where(and(eq(companyMcpServers.companyId, companyId), eq(companyMcpServers.scope, "company")))
    .limit(1);

  if (existing.length > 0) return; // Already seeded, skip

  for (const mcp of DEFAULT_MCPS) {
    await db.insert(companyMcpServers).values({
      companyId,
      name: mcp.name,
      description: mcp.description ?? null,
      transportType: mcp.transportType,
      command: mcp.command ?? "",
      args: mcp.args ?? [],
      env: {},
      scope: "company",
      source: "manual",
      enabled: true,
    });
  }
}
