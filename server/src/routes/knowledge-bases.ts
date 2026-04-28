import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { knowledgeBases, knowledgeDocuments, agentKnowledgeBases, companies } from "@paperclipai/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { assertCompanyAccess } from "./authz.js";
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  kbQuerySchema,
} from "@paperclipai/shared";
import { ensureCollection, deleteCollection, getChromaClient } from "../services/chroma-client.js";
import { logger } from "../middleware/logger.js";
import { randomUUID } from "node:crypto";

function generateCollectionName(companyId: string, name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30);
  return `kb_${companyId.slice(0, 8)}_${slug}_${randomUUID().slice(0, 8)}`;
}

export function knowledgeBaseRoutes(db: Db) {
  const router = Router();

  // ── Knowledge Bases ──────────────────────────────────────────────────────

  router.get("/companies/:companyId/knowledge-bases", async (req, res, next) => {
    try {
      const { companyId } = req.params as { companyId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.companyId, companyId))
        .orderBy(desc(knowledgeBases.updatedAt));
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post(
    "/companies/:companyId/knowledge-bases",
    validate(createKnowledgeBaseSchema),
    async (req, res, next) => {
      try {
        const { companyId } = req.params as { companyId: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as unknown as { name: string; description?: string; embeddingModel?: string };
        const now = new Date();
        const collectionName = generateCollectionName(companyId, body.name);

        const [created] = await db
          .insert(knowledgeBases)
          .values({
            companyId,
            name: body.name,
            description: body.description ?? null,
            chromaCollectionName: collectionName,
            embeddingModel: body.embeddingModel ?? "nomic-embed-text",
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await ensureCollection(collectionName);
        res.status(201).json(created);
      } catch (err) {
        next(err);
      }
    },
  );

  router.patch(
    "/companies/:companyId/knowledge-bases/:kbId",
    validate(updateKnowledgeBaseSchema),
    async (req, res, next) => {
      try {
        const { companyId, kbId } = req.params as { companyId: string; kbId: string };
        assertCompanyAccess(req, companyId);
        const body = req.body as unknown as { name?: string; description?: string; embeddingModel?: string };
        const now = new Date();

        const [updated] = await db
          .update(knowledgeBases)
          .set({ ...body, updatedAt: now })
          .where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.companyId, companyId)))
          .returning();

        if (!updated) {
          res.status(404).json({ error: "Knowledge base not found" });
          return;
        }
        res.json(updated);
      } catch (err) {
        next(err);
      }
    },
  );

  router.delete("/companies/:companyId/knowledge-bases/:kbId", async (req, res, next) => {
    try {
      const { companyId, kbId } = req.params as { companyId: string; kbId: string };
      assertCompanyAccess(req, companyId);

      const kb = await db
        .select()
        .from(knowledgeBases)
        .where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!kb) {
        res.status(404).json({ error: "Knowledge base not found" });
        return;
      }

      await db
        .delete(knowledgeDocuments)
        .where(eq(knowledgeDocuments.kbId, kbId));
      await db
        .delete(agentKnowledgeBases)
        .where(eq(agentKnowledgeBases.kbId, kbId));
      await db
        .delete(knowledgeBases)
        .where(eq(knowledgeBases.id, kbId));

      await deleteCollection(kb.chromaCollectionName);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Documents ────────────────────────────────────────────────────────────

  router.get("/companies/:companyId/knowledge-bases/:kbId/documents", async (req, res, next) => {
    try {
      const { companyId, kbId } = req.params as { companyId: string; kbId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select()
        .from(knowledgeDocuments)
        .where(and(eq(knowledgeDocuments.kbId, kbId), eq(knowledgeDocuments.companyId, companyId)))
        .orderBy(desc(knowledgeDocuments.createdAt));
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.post("/companies/:companyId/knowledge-bases/:kbId/documents", async (req, res, next) => {
    try {
      const { companyId, kbId } = req.params as { companyId: string; kbId: string };
      assertCompanyAccess(req, companyId);
      const body = req.body as unknown as { filename: string; fileSize?: number; content?: string };
      const now = new Date();

      const kb = await db
        .select()
        .from(knowledgeBases)
        .where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.companyId, companyId)))
        .then((rows) => rows[0] ?? null);

      if (!kb) {
        res.status(404).json({ error: "Knowledge base not found" });
        return;
      }

      const [doc] = await db
        .insert(knowledgeDocuments)
        .values({
          kbId,
          companyId,
          filename: body.filename,
          fileSize: body.fileSize ?? null,
          chunkCount: null,
          embedModel: kb.embeddingModel ?? "nomic-embed-text",
          status: "pending",
          error: null,
          uploadedBy: req.actor.type === "board" ? req.actor.userId : null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Fire-and-forget ingestion
      if (body.content) {
        ingestDocument(db, doc.id, kbId, kb.chromaCollectionName, kb.embeddingModel, body.content).catch((err) => {
          logger.warn({ err, docId: doc.id }, "Document ingestion failed");
        });
      }

      res.status(201).json(doc);
    } catch (err) {
      logger.warn({ err, method: "createDocument" }, "Knowledge base document creation failed");
      next(err);
    }
  });

  router.delete("/companies/:companyId/knowledge-bases/:kbId/documents/:docId", async (req, res, next) => {
    try {
      const { companyId, kbId, docId } = req.params as { companyId: string; kbId: string; docId: string };
      assertCompanyAccess(req, companyId);

      const doc = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.id, docId),
            eq(knowledgeDocuments.kbId, kbId),
            eq(knowledgeDocuments.companyId, companyId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!doc) {
        res.status(404).json({ error: "Document not found" });
        return;
      }

      const kb = await db
        .select()
        .from(knowledgeBases)
        .where(eq(knowledgeBases.id, kbId))
        .then((rows) => rows[0] ?? null);

      if (kb) {
        const collection = await ensureCollection(kb.chromaCollectionName);
        if (collection) {
          try {
            await collection.delete({ where: { document_id: docId } });
          } catch (err) {
            logger.warn({ err, docId }, "Failed to delete document vectors from Chroma");
          }
        }
      }

      await db.delete(knowledgeDocuments).where(eq(knowledgeDocuments.id, docId));
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // ── Query ────────────────────────────────────────────────────────────────

  router.post(
    "/companies/:companyId/knowledge-bases/:kbId/query",
    validate(kbQuerySchema),
    async (req, res, next) => {
      try {
        const { companyId, kbId } = req.params as { companyId: string; kbId: string };
        assertCompanyAccess(req, companyId);
        const { query, topK } = req.body as unknown as { query: string; topK?: number };

        const kb = await db
          .select()
          .from(knowledgeBases)
          .where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.companyId, companyId)))
          .then((rows) => rows[0] ?? null);

        if (!kb) {
          res.status(404).json({ error: "Knowledge base not found" });
          return;
        }

        const collection = await ensureCollection(kb.chromaCollectionName);
        if (!collection) {
          res.status(503).json({ error: "Knowledge base storage unavailable" });
          return;
        }

        const results = await collection.query({
          queryTexts: [query],
          nResults: topK ?? 5,
        });

        const documents = results.documents[0] ?? [];
        const metadatas = results.metadatas[0] ?? [];
        const distances = results.distances?.[0] ?? [];

        const out = documents.map((text, i) => ({
          text: text ?? "",
          sourceFile: (metadatas[i] as Record<string, unknown> | null)?.source_file as string ?? "",
          headingPath: (metadatas[i] as Record<string, unknown> | null)?.heading_path as string ?? undefined,
          relevanceScore: 1 - (distances[i] ?? 0),
        }));

        res.json({ results: out });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Agent Assignments ────────────────────────────────────────────────────

  router.get("/companies/:companyId/agents/:agentId/knowledge-bases", async (req, res, next) => {
    try {
      const { companyId, agentId } = req.params as { companyId: string; agentId: string };
      assertCompanyAccess(req, companyId);
      const rows = await db
        .select({
          id: agentKnowledgeBases.id,
          agentId: agentKnowledgeBases.agentId,
          kbId: agentKnowledgeBases.kbId,
          priority: agentKnowledgeBases.priority,
          createdAt: agentKnowledgeBases.createdAt,
          kbName: knowledgeBases.name,
        })
        .from(agentKnowledgeBases)
        .innerJoin(knowledgeBases, eq(agentKnowledgeBases.kbId, knowledgeBases.id))
        .where(and(eq(agentKnowledgeBases.agentId, agentId), eq(knowledgeBases.companyId, companyId)))
        .orderBy(agentKnowledgeBases.priority);
      res.json(rows);
    } catch (err) {
      next(err);
    }
  });

  router.put("/companies/:companyId/agents/:agentId/knowledge-bases", async (req, res, next) => {
    try {
      const { companyId, agentId } = req.params as { companyId: string; agentId: string };
      assertCompanyAccess(req, companyId);
      const body = req.body as unknown as { kbIds: string[] };
      const { kbIds } = body;

      if (!Array.isArray(kbIds)) {
        res.status(400).json({ error: "kbIds must be an array" });
        return;
      }

      await db
        .delete(agentKnowledgeBases)
        .where(eq(agentKnowledgeBases.agentId, agentId));

      if (kbIds.length > 0) {
        const companyKbIds = await db
          .select({ id: knowledgeBases.id })
          .from(knowledgeBases)
          .where(and(eq(knowledgeBases.companyId, companyId), sql`${knowledgeBases.id} = ANY(${kbIds})`))
          .then((rows) => rows.map((r) => r.id));

        const now = new Date();
        await db.insert(agentKnowledgeBases).values(
          companyKbIds.map((kbId, idx) => ({
            agentId,
            kbId,
            priority: idx,
            createdAt: now,
          })),
        );
      }

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

// ── Ingestion ──────────────────────────────────────────────────────────────

async function ingestDocument(
  db: Db,
  docId: string,
  _kbId: string,
  collectionName: string,
  _embedModel: string,
  content: string,
) {
  await db
    .update(knowledgeDocuments)
    .set({ status: "processing", updatedAt: new Date() })
    .where(eq(knowledgeDocuments.id, docId));

  try {
    const collection = await ensureCollection(collectionName);
    if (!collection) throw new Error("Chroma collection unavailable");

    const chunks = chunkText(content, 512, 64);
    const ids = chunks.map((_, i) => `${docId}_chunk_${i}`);
    const metadatas = chunks.map(() => ({ document_id: docId }));

    await collection.add({
      ids,
      documents: chunks,
      metadatas,
    });

    await db
      .update(knowledgeDocuments)
      .set({ status: "ready", chunkCount: chunks.length, updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, docId));
  } catch (err) {
    logger.warn({ err, docId }, "Ingestion failed");
    await db
      .update(knowledgeDocuments)
      .set({ status: "failed", error: err instanceof Error ? err.message : String(err), updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, docId));
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    chunks.push(text.slice(i, end));
    i += chunkSize - overlap;
    if (i >= text.length) break;
  }
  return chunks;
}
