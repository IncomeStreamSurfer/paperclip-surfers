import { Router } from "express";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { memoryBindings, memoryOperations, agents, projects, issues } from "@paperclipai/db";
import type { MemoryAdapter, MemoryScopeInput } from "@paperclipai/shared";
import { createMemoryBindingSchema, updateMemoryBindingSchema, memoryQueryApiSchema, memoryWriteApiSchema } from "@paperclipai/shared";
import { assertCompanyAccess } from "./authz.js";
import { validate } from "../middleware/validate.js";
import { createChromaAdapter, getMemoryAdapter, registerMemoryAdapter } from "../services/memory/registry.js";
import { logger } from "../middleware/logger.js";

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

export function memoryBindingRoutes(db: Db) {
  const router = Router();

  // List bindings for a company
  router.get("/companies/:companyId/memory-bindings", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const agentId = req.query.agentId as string | undefined;
      const rows = await db
        .select()
        .from(memoryBindings)
        .where(
          agentId
            ? and(eq(memoryBindings.companyId, companyId), eq(memoryBindings.agentId, agentId))
            : eq(memoryBindings.companyId, companyId),
        )
        .orderBy(desc(memoryBindings.createdAt));

      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  // Create binding
  router.post(
    "/companies/:companyId/memory-bindings",
    validate(createMemoryBindingSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);

        const body = req.body as z.infer<typeof createMemoryBindingSchema>;
        const [binding] = await db
          .insert(memoryBindings)
          .values({
            companyId,
            agentId: body.agentId ?? null,
            projectId: body.projectId ?? null,
            issueId: body.issueId ?? null,
            scope: body.scope,
            providerKind: body.providerKind,
            config: body.config ?? {},
            enabled: body.enabled ?? true,
          })
          .returning();

        // Register adapter immediately
        resolveAdapter(binding);

        res.status(201).json(binding);
      } catch (err) {
        next(err);
      }
    },
  );

  // Get binding
  router.get("/companies/:companyId/memory-bindings/:bindingId", async (req, res, next) => {
    try {
      const { companyId, bindingId } = req.params as { companyId: string; bindingId: string };
      assertCompanyAccess(req, companyId);

      const [binding] = await db
        .select()
        .from(memoryBindings)
        .where(and(eq(memoryBindings.id, bindingId), eq(memoryBindings.companyId, companyId)))
        .limit(1);

      if (!binding) {
        res.status(404).json({ error: "Binding not found" });
        return;
      }

      res.json(binding);
    } catch (err) {
      next(err);
    }
  });

  // Update binding
  router.patch(
    "/companies/:companyId/memory-bindings/:bindingId",
    validate(updateMemoryBindingSchema),
    async (req, res, next) => {
      try {
        const { companyId, bindingId } = req.params as { companyId: string; bindingId: string };
        assertCompanyAccess(req, companyId);

        const body = req.body as z.infer<typeof updateMemoryBindingSchema>;
        const [existing] = await db
          .select()
          .from(memoryBindings)
          .where(and(eq(memoryBindings.id, bindingId), eq(memoryBindings.companyId, companyId)))
          .limit(1);

        if (!existing) {
          res.status(404).json({ error: "Binding not found" });
          return;
        }

        const [updated] = await db
          .update(memoryBindings)
          .set({
            ...(body.scope !== undefined && { scope: body.scope }),
            ...(body.providerKind !== undefined && { providerKind: body.providerKind }),
            ...(body.config !== undefined && { config: body.config }),
            ...(body.enabled !== undefined && { enabled: body.enabled }),
            updatedAt: new Date(),
          })
          .where(eq(memoryBindings.id, bindingId))
          .returning();

        // Re-register adapter
        resolveAdapter(updated);

        res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  // Delete binding
  router.delete("/companies/:companyId/memory-bindings/:bindingId", async (req, res, next) => {
    try {
      const { companyId, bindingId } = req.params as { companyId: string; bindingId: string };
      assertCompanyAccess(req, companyId);

      const [existing] = await db
        .select()
        .from(memoryBindings)
        .where(and(eq(memoryBindings.id, bindingId), eq(memoryBindings.companyId, companyId)))
        .limit(1);

      if (!existing) {
        res.status(404).json({ error: "Binding not found" });
        return;
      }

      await db.delete(memoryBindings).where(eq(memoryBindings.id, bindingId));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // Query memory through a binding
  router.post(
    "/companies/:companyId/memory-bindings/:bindingId/query",
    validate(memoryQueryApiSchema),
    async (req, res, next) => {
      try {
        const { companyId, bindingId } = req.params as { companyId: string; bindingId: string };
        assertCompanyAccess(req, companyId);

        const [binding] = await db
          .select()
          .from(memoryBindings)
          .where(and(eq(memoryBindings.id, bindingId), eq(memoryBindings.companyId, companyId)))
          .limit(1);

        if (!binding) {
          res.status(404).json({ error: "Binding not found" });
          return;
        }
        if (!binding.enabled) {
          res.status(409).json({ error: "Binding is disabled" });
          return;
        }

        const body = req.body as z.infer<typeof memoryQueryApiSchema>;
        const adapter = resolveAdapter(binding);
        const scope: MemoryScopeInput = {
          companyId,
          agentId: binding.agentId ?? undefined,
          projectId: binding.projectId ?? undefined,
          issueId: binding.issueId ?? undefined,
        };

        const start = Date.now();
        const result = await adapter.query({
          bindingKey: bindingId,
          scope,
          query: body.query,
          topK: body.topK,
          intent: body.intent,
        });
        const latencyMs = Date.now() - start;

        // Audit log
        await db.insert(memoryOperations).values({
          bindingId,
          companyId,
          agentId: binding.agentId ?? null,
          issueId: binding.issueId ?? null,
          op: "query",
          queryText: body.query,
          tokensUsed: body.query.length / 4,
          latencyMs,
        });

        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // Write memory through a binding
  router.post(
    "/companies/:companyId/memory-bindings/:bindingId/write",
    validate(memoryWriteApiSchema),
    async (req, res, next) => {
      try {
        const { companyId, bindingId } = req.params as { companyId: string; bindingId: string };
        assertCompanyAccess(req, companyId);

        const [binding] = await db
          .select()
          .from(memoryBindings)
          .where(and(eq(memoryBindings.id, bindingId), eq(memoryBindings.companyId, companyId)))
          .limit(1);

        if (!binding) {
          res.status(404).json({ error: "Binding not found" });
          return;
        }
        if (!binding.enabled) {
          res.status(409).json({ error: "Binding is disabled" });
          return;
        }

        const body = req.body as z.infer<typeof memoryWriteApiSchema>;
        const adapter = resolveAdapter(binding);
        const scope: MemoryScopeInput = {
          companyId,
          agentId: binding.agentId ?? undefined,
          projectId: binding.projectId ?? undefined,
          issueId: binding.issueId ?? undefined,
        };

        const start = Date.now();
        const result = await adapter.write({
          bindingKey: bindingId,
          scope,
          source: {
            kind: body.sourceKind,
            companyId,
          },
          content: body.content,
          metadata: body.metadata,
          mode: body.mode,
        });
        const latencyMs = Date.now() - start;

        // Audit log
        await db.insert(memoryOperations).values({
          bindingId,
          companyId,
          agentId: binding.agentId ?? null,
          issueId: binding.issueId ?? null,
          op: "write",
          tokensUsed: body.content.length / 4,
          latencyMs,
        });

        res.status(201).json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  // List memory operations
  router.get("/companies/:companyId/memory-operations", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);

      const agentId = req.query.agentId as string | undefined;
      const bindingId = req.query.bindingId as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const conditions = [eq(memoryOperations.companyId, companyId)];
      if (agentId) conditions.push(eq(memoryOperations.agentId, agentId));
      if (bindingId) conditions.push(eq(memoryOperations.bindingId, bindingId));

      const rows = await db
        .select()
        .from(memoryOperations)
        .where(and(...conditions))
        .orderBy(desc(memoryOperations.createdAt))
        .limit(limit);

      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
