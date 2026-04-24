import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { companyMcpServers, agentMcpExclusions } from "@paperclipai/db";

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  type?: "stdio" | "http" | "sse";
  url?: string;
}

export function mcpResolverService(db: Db) {
  return {
    async resolveMcpConfig(agentId: string, companyId: string) {
      // V2: Opt-in model — agents only get MCPs explicitly assigned to them.
      // Company-wide MCPs are a catalog; they must be explicitly added per agent.
      const servers = await db
        .select()
        .from(companyMcpServers)
        .where(
          and(
            eq(companyMcpServers.companyId, companyId),
            eq(companyMcpServers.enabled, true),
            eq(companyMcpServers.scope, "agent"),
            eq(companyMcpServers.agentId, agentId),
          ),
        );

      return servers;
    },

    async writeMcpConfigFile(
      servers: Array<{
        name: string;
        command: string;
        args: string[];
        env: Record<string, string>;
        transportType: string;
        transportUrl?: string | null;
      }>,
      tempDir: string,
    ) {
      const mcpConfig: Record<string, McpServerConfig> = {};

      for (const server of servers) {
        if (server.transportType === "http" || server.transportType === "sse") {
          // HTTP/SSE MCP servers use type + url format
          mcpConfig[server.name] = {
            type: server.transportType as "http" | "sse",
            url: server.transportUrl ?? "",
          };
        } else {
          // stdio MCP servers use command + args format
          mcpConfig[server.name] = {
            command: server.command,
            args: server.args,
            env: server.env,
          };
        }
      }

      const configPath = path.join(tempDir, "mcp-config.json");
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({ mcpServers: mcpConfig }, null, 2));

      return configPath;
    },

    async syncFromClaudeCode(companyId: string) {
      // Claude Code stores MCPs in ~/.claude.json:
      //   - "mcpServers" for user-scoped MCPs
      //   - "projects.<path>.mcpServers" for project-scoped MCPs
      // Also reads .mcp.json in current working directory

      const discovered: Array<{
        name: string;
        command: string;
        args: string[];
        env: Record<string, string>;
        transportType: "stdio" | "http" | "sse";
        transportUrl?: string;
        configPath: string;
        projectPath?: string;
      }> = [];

      const claudeJsonPath = path.join(os.homedir(), ".claude.json");

      // Helper to extract MCPs from a mcpServers object
      const extractMcps = (
        mcpServers: Record<string, { command?: string; args?: string[]; env?: Record<string, string>; type?: string; url?: string }>,
        configPath: string,
        projectPath?: string,
      ) => {
        for (const [name, config] of Object.entries(mcpServers)) {
          const transportType = (config.type as "stdio" | "http" | "sse") ?? "stdio";
          // Deduplicate by name — user-scoped takes priority over project-scoped
          if (!discovered.find((d) => d.name === name)) {
            discovered.push({
              name,
              command: config.command ?? "",
              args: config.args ?? [],
              env: config.env ?? {},
              transportType,
              transportUrl: config.url,
              configPath,
              projectPath,
            });
          }
        }
      };

      // Read ~/.claude.json — user-scoped MCPs + project-scoped MCPs
      if (fs.existsSync(claudeJsonPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(claudeJsonPath, "utf-8")) as Record<string, unknown>;

          // User-scoped MCPs
          if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
            extractMcps(
              parsed.mcpServers as Record<string, { command?: string; args?: string[]; env?: Record<string, string>; type?: string; url?: string }>,
              claudeJsonPath,
            );
          }

          // Project-scoped MCPs from all projects
          const projects = (parsed.projects ?? {}) as Record<string, { mcpServers?: Record<string, unknown> }>;
          for (const [projectPath, projectConfig] of Object.entries(projects)) {
            if (projectConfig.mcpServers && typeof projectConfig.mcpServers === "object") {
              extractMcps(
                projectConfig.mcpServers as Record<string, { command?: string; args?: string[]; env?: Record<string, string>; type?: string; url?: string }>,
                claudeJsonPath,
                projectPath,
              );
            }
          }
        } catch {
          // ignore parse errors
        }
      }

      // Also read .mcp.json in cwd if present
      const cwdMcpJson = path.join(process.cwd(), ".mcp.json");
      if (fs.existsSync(cwdMcpJson)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(cwdMcpJson, "utf-8")) as Record<string, unknown>;
          if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
            extractMcps(
              parsed.mcpServers as Record<string, { command?: string; args?: string[]; env?: Record<string, string>; type?: string; url?: string }>,
              cwdMcpJson,
            );
          }
        } catch {
          // ignore
        }
      }

      // Upsert into DB — unique on (companyId, name)
      for (const server of discovered) {
        await db
          .insert(companyMcpServers)
          .values({
            companyId,
            name: server.name,
            command: server.command,
            args: server.args,
            env: server.env,
            transportType: server.transportType,
            transportUrl: server.transportUrl ?? null,
            source: "claude_code_discovered",
            claudeCodeConfigPath: server.configPath,
            scope: "company",
            enabled: true,
          })
          .onConflictDoUpdate({
            target: [companyMcpServers.companyId, companyMcpServers.name],
            set: {
              command: server.command,
              args: server.args,
              env: server.env,
              transportType: server.transportType,
              transportUrl: server.transportUrl ?? null,
              claudeCodeConfigPath: server.configPath,
              updatedAt: sql`now()`,
            },
          });
      }

      return { discovered, message: `Discovered ${discovered.length} MCP servers from Claude Code` };
    },

    async listServers(companyId: string) {
      return db
        .select()
        .from(companyMcpServers)
        .where(eq(companyMcpServers.companyId, companyId));
    },

    async createServer(data: {
      companyId: string;
      name: string;
      description?: string | null;
      command: string;
      args?: string[];
      env?: Record<string, string>;
      transportType: "stdio" | "http" | "sse";
      transportUrl?: string | null;
      scope?: "company" | "agent";
      agentId?: string | null;
    }) {
      const [server] = await db
        .insert(companyMcpServers)
        .values({
          companyId: data.companyId,
          name: data.name,
          description: data.description ?? null,
          command: data.command,
          args: data.args ?? [],
          env: data.env ?? {},
          transportType: data.transportType,
          transportUrl: data.transportUrl ?? null,
          source: "manual",
          scope: data.scope ?? "company",
          agentId: data.agentId ?? null,
          enabled: true,
        })
        .returning();

      return server;
    },

    async updateServer(
      serverId: string,
      data: {
        name?: string;
        description?: string | null;
        command?: string;
        args?: string[];
        env?: Record<string, string>;
        transportType?: "stdio" | "http" | "sse";
        transportUrl?: string | null;
        enabled?: boolean;
      },
    ) {
      const [updated] = await db
        .update(companyMcpServers)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(companyMcpServers.id, serverId))
        .returning();

      return updated;
    },

    async deleteServer(serverId: string) {
      const [deleted] = await db
        .delete(companyMcpServers)
        .where(eq(companyMcpServers.id, serverId))
        .returning();

      return deleted;
    },

    async addExclusion(agentId: string, mcpServerId: string) {
      await db
        .insert(agentMcpExclusions)
        .values({ agentId, mcpServerId })
        .onConflictDoNothing();

      return { success: true };
    },

    async removeExclusion(agentId: string, mcpServerId: string) {
      await db
        .delete(agentMcpExclusions)
        .where(
          and(
            eq(agentMcpExclusions.agentId, agentId),
            eq(agentMcpExclusions.mcpServerId, mcpServerId),
          ),
        );

      return { success: true };
    },

    async listExclusions(agentId: string) {
      return db
        .select()
        .from(agentMcpExclusions)
        .where(eq(agentMcpExclusions.agentId, agentId));
    },
  };
}
