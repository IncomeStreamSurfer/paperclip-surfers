import type { Db } from "@paperclipai/db";
import { memoryBindings, memoryOperations } from "@paperclipai/db";
import { eq, and, desc } from "drizzle-orm";
import type { MemoryAdapter, MemoryScopeInput } from "@paperclipai/shared";
import { createChromaAdapter, getMemoryAdapter, registerMemoryAdapter } from "../memory/registry.js";
import { logger } from "../../middleware/logger.js";

function resolveAdapter(binding: typeof memoryBindings.$inferSelect): MemoryAdapter {
  const adapter = getMemoryAdapter(binding.companyId, binding.id);
  if (adapter) return adapter;

  const scopeId =
    binding.scope === "agent"
      ? binding.agentId ?? undefined
      : binding.scope === "project"
        ? binding.projectId ?? undefined
        : binding.scope === "issue"
          ? binding.issueId ?? undefined
          : undefined;

  const config = (binding.config ?? {}) as { topK?: number; minScore?: number };
  const newAdapter = createChromaAdapter({
    companyId: binding.companyId,
    scope: binding.scope,
    scopeId,
    topK: config.topK,
    minScore: config.minScore,
  });
  registerMemoryAdapter(binding.companyId, binding.id, newAdapter);
  return newAdapter;
}

export async function hydrateMemPalace(
  db: Db,
  companyId: string,
  agentId: string,
  issueId: string | undefined,
  projectId: string | undefined,
  queryText: string,
): Promise<string> {
  try {
    const bindings = await db
      .select()
      .from(memoryBindings)
      .where(
        and(
          eq(memoryBindings.companyId, companyId),
          eq(memoryBindings.enabled, true),
          and(
            eq(memoryBindings.scope, "company"),
          ),
        ),
      )
      .orderBy(desc(memoryBindings.createdAt));

    // Also fetch agent-specific bindings
    const agentBindings = await db
      .select()
      .from(memoryBindings)
      .where(
        and(
          eq(memoryBindings.companyId, companyId),
          eq(memoryBindings.enabled, true),
          eq(memoryBindings.scope, "agent"),
          eq(memoryBindings.agentId, agentId),
        ),
      )
      .orderBy(desc(memoryBindings.createdAt));

    const allBindings = [...bindings, ...agentBindings];
    if (allBindings.length === 0) return "";

    const snippets: string[] = [];
    for (const binding of allBindings) {
      const adapter = resolveAdapter(binding);
      const scope: MemoryScopeInput = {
        companyId,
        agentId: binding.agentId ?? undefined,
        projectId: binding.projectId ?? undefined,
        issueId: binding.issueId ?? undefined,
      };

      const start = Date.now();
      const result = await adapter.query({
        bindingKey: binding.id,
        scope,
        query: queryText,
        topK: 5,
        intent: "agent_preamble",
      });
      const latencyMs = Date.now() - start;

      // Audit log
      await db.insert(memoryOperations).values({
        bindingId: binding.id,
        companyId,
        agentId,
        issueId: issueId ?? null,
        op: "query",
        queryText,
        tokensUsed: queryText.length / 4,
        latencyMs,
      });

      for (const snippet of result.snippets) {
        if (snippet.score && snippet.score < 0.3) continue;
        snippets.push(snippet.text);
      }
    }

    if (snippets.length === 0) return "";

    return `## Relevant Context from MemPalace\n\n${snippets.map((s, i) => `${i + 1}. ${s}`).join("\n\n")}\n\n`;
  } catch (err) {
    logger.warn({ err, companyId, agentId }, "MemPalace hydration failed");
    return "";
  }
}

export async function captureRunToMemPalace(
  db: Db,
  companyId: string,
  agentId: string,
  runId: string,
  issueId: string | undefined,
  summary: string,
): Promise<void> {
  try {
    const bindings = await db
      .select()
      .from(memoryBindings)
      .where(
        and(
          eq(memoryBindings.companyId, companyId),
          eq(memoryBindings.enabled, true),
          eq(memoryBindings.scope, "agent"),
          eq(memoryBindings.agentId, agentId),
        ),
      );

    // Also capture to company-wide binding if configured
    const companyBindings = await db
      .select()
      .from(memoryBindings)
      .where(
        and(
          eq(memoryBindings.companyId, companyId),
          eq(memoryBindings.enabled, true),
          eq(memoryBindings.scope, "company"),
        ),
      );

    const allBindings = [...bindings, ...companyBindings];
    if (allBindings.length === 0) return;

    for (const binding of allBindings) {
      const config = (binding.config ?? {}) as { captureRuns?: boolean };
      if (binding.scope === "agent" && config.captureRuns === false) continue;

      const adapter = resolveAdapter(binding);
      const scope: MemoryScopeInput = {
        companyId,
        agentId: binding.agentId ?? undefined,
        projectId: binding.projectId ?? undefined,
        issueId: binding.issueId ?? undefined,
        runId,
      };

      const start = Date.now();
      await adapter.write({
        bindingKey: binding.id,
        scope,
        source: { kind: "run", companyId, runId },
        content: summary,
        metadata: { runId, issueId },
      });
      const latencyMs = Date.now() - start;

      // Audit log
      await db.insert(memoryOperations).values({
        bindingId: binding.id,
        companyId,
        agentId,
        runId,
        issueId: issueId ?? null,
        op: "write",
        tokensUsed: summary.length / 4,
        latencyMs,
      });
    }
  } catch (err) {
    logger.warn({ err, companyId, agentId, runId }, "MemPalace run capture failed");
  }
}
