import { z } from "zod";

export const KNOWLEDGE_DOCUMENT_STATUSES = ["pending", "processing", "ready", "failed"] as const;
export type KnowledgeDocumentStatus = (typeof KNOWLEDGE_DOCUMENT_STATUSES)[number];

export const knowledgeBaseSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  chromaCollectionName: z.string(),
  embeddingModel: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;

export const createKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  embeddingModel: z.string().optional(),
});

export type CreateKnowledgeBase = z.infer<typeof createKnowledgeBaseSchema>;

export const updateKnowledgeBaseSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  embeddingModel: z.string().optional(),
});

export type UpdateKnowledgeBase = z.infer<typeof updateKnowledgeBaseSchema>;

export const knowledgeDocumentSchema = z.object({
  id: z.string().uuid(),
  kbId: z.string().uuid(),
  companyId: z.string().uuid(),
  filename: z.string(),
  fileSize: z.number().int().nullable(),
  chunkCount: z.number().int().nullable(),
  embedModel: z.string(),
  status: z.enum(KNOWLEDGE_DOCUMENT_STATUSES),
  error: z.string().nullable(),
  uploadedBy: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type KnowledgeDocument = z.infer<typeof knowledgeDocumentSchema>;

export const agentKnowledgeBaseSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  kbId: z.string().uuid(),
  priority: z.number().int(),
  createdAt: z.string().datetime(),
});

export type AgentKnowledgeBase = z.infer<typeof agentKnowledgeBaseSchema>;

export const kbQuerySchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional().default(5),
});

export type KbQuery = z.infer<typeof kbQuerySchema>;

export const kbQueryResultSchema = z.object({
  text: z.string(),
  sourceFile: z.string(),
  headingPath: z.string().optional(),
  relevanceScore: z.number(),
});

export type KbQueryResult = z.infer<typeof kbQueryResultSchema>;
