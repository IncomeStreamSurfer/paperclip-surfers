import { pgTable, uuid, text, timestamp, jsonb, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";

export const knowledgeBases = pgTable(
  "knowledge_bases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    chromaCollectionName: text("chroma_collection_name").notNull(),
    embeddingModel: text("embedding_model").notNull().default("nomic-embed-text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdIdx: index("knowledge_bases_company_id_idx").on(table.companyId),
  }),
);

export const knowledgeDocuments = pgTable(
  "knowledge_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kbId: uuid("kb_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    fileSize: integer("file_size"),
    chunkCount: integer("chunk_count"),
    embedModel: text("embed_model").notNull().default("nomic-embed-text"),
    status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'ready' | 'failed'
    error: text("error"),
    uploadedBy: uuid("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    kbIdIdx: index("knowledge_documents_kb_id_idx").on(table.kbId),
    companyIdIdx: index("knowledge_documents_company_id_idx").on(table.companyId),
    statusIdx: index("knowledge_documents_status_idx").on(table.status),
  }),
);

export const agentKnowledgeBases = pgTable(
  "agent_knowledge_bases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
    kbId: uuid("kb_id").notNull().references(() => knowledgeBases.id, { onDelete: "cascade" }),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentKbUnique: uniqueIndex("agent_kb_unique_idx").on(table.agentId, table.kbId),
  }),
);
