import { z } from "zod";

export const MEMORY_SCOPES = ["company", "agent", "project", "issue"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

export const MEMORY_PROVIDER_KINDS = ["chroma", "markdown"] as const;
export type MemoryProviderKind = (typeof MEMORY_PROVIDER_KINDS)[number];

export const MEMORY_OPS = ["write", "query", "forget", "browse", "correct"] as const;
export type MemoryOp = (typeof MEMORY_OPS)[number];

export const memoryAdapterCapabilitiesSchema = z.object({
  profile: z.boolean().optional(),
  browse: z.boolean().optional(),
  correction: z.boolean().optional(),
  asyncIngestion: z.boolean().optional(),
  multimodal: z.boolean().optional(),
  providerManagedExtraction: z.boolean().optional(),
});

export type MemoryAdapterCapabilities = z.infer<typeof memoryAdapterCapabilitiesSchema>;

export const memoryScopeSchema = z.object({
  companyId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  subjectId: z.string().optional(),
});

export type MemoryScopeInput = z.infer<typeof memoryScopeSchema>;

export const memorySourceRefSchema = z.object({
  kind: z.enum(["issue_comment", "issue_document", "issue", "run", "activity", "manual_note", "external_document"]),
  companyId: z.string().uuid(),
  issueId: z.string().uuid().optional(),
  commentId: z.string().uuid().optional(),
  documentKey: z.string().optional(),
  runId: z.string().uuid().optional(),
  activityId: z.string().uuid().optional(),
  externalRef: z.string().optional(),
});

export type MemorySourceRef = z.infer<typeof memorySourceRefSchema>;

export const memoryUsageSchema = z.object({
  provider: z.string(),
  model: z.string().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  embeddingTokens: z.number().optional(),
  costCents: z.number().optional(),
  latencyMs: z.number().optional(),
  details: z.record(z.unknown()).optional(),
});

export type MemoryUsage = z.infer<typeof memoryUsageSchema>;

export const memoryWriteRequestSchema = z.object({
  bindingKey: z.string(),
  scope: memoryScopeSchema,
  source: memorySourceRefSchema,
  content: z.string().min(1).max(50000),
  metadata: z.record(z.unknown()).optional(),
  mode: z.enum(["append", "upsert", "summarize"]).optional(),
});

export type MemoryWriteRequest = z.infer<typeof memoryWriteRequestSchema>;

export const memoryRecordHandleSchema = z.object({
  providerKey: z.string(),
  providerRecordId: z.string(),
});

export type MemoryRecordHandle = z.infer<typeof memoryRecordHandleSchema>;

export const memoryQueryRequestSchema = z.object({
  bindingKey: z.string(),
  scope: memoryScopeSchema,
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional(),
  intent: z.enum(["agent_preamble", "answer", "browse"]).optional(),
  metadataFilter: z.record(z.unknown()).optional(),
});

export type MemoryQueryRequest = z.infer<typeof memoryQueryRequestSchema>;

export const memorySnippetSchema = z.object({
  handle: memoryRecordHandleSchema,
  text: z.string(),
  score: z.number().optional(),
  summary: z.string().optional(),
  source: memorySourceRefSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type MemorySnippet = z.infer<typeof memorySnippetSchema>;

export const memoryContextBundleSchema = z.object({
  snippets: z.array(memorySnippetSchema),
  profileSummary: z.string().optional(),
  usage: z.array(memoryUsageSchema).optional(),
});

export type MemoryContextBundle = z.infer<typeof memoryContextBundleSchema>;

export interface MemoryAdapter {
  key: string;
  capabilities: MemoryAdapterCapabilities;
  write(req: MemoryWriteRequest): Promise<{
    records?: MemoryRecordHandle[];
    usage?: MemoryUsage[];
  }>;
  query(req: MemoryQueryRequest): Promise<MemoryContextBundle>;
  get(handle: MemoryRecordHandle, scope: MemoryScopeInput): Promise<MemorySnippet | null>;
  forget(handles: MemoryRecordHandle[], scope: MemoryScopeInput): Promise<{ usage?: MemoryUsage[] }>;
}

// ── API Schemas ────────────────────────────────────────────────────────────

export const memoryBindingSchema = z.object({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  issueId: z.string().uuid().nullable(),
  scope: z.enum(MEMORY_SCOPES),
  providerKind: z.enum(MEMORY_PROVIDER_KINDS),
  config: z.record(z.unknown()),
  enabled: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type MemoryBinding = z.infer<typeof memoryBindingSchema>;

export const createMemoryBindingSchema = z.object({
  agentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  issueId: z.string().uuid().optional(),
  scope: z.enum(MEMORY_SCOPES),
  providerKind: z.enum(MEMORY_PROVIDER_KINDS),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export type CreateMemoryBinding = z.infer<typeof createMemoryBindingSchema>;

export const updateMemoryBindingSchema = z.object({
  scope: z.enum(MEMORY_SCOPES).optional(),
  providerKind: z.enum(MEMORY_PROVIDER_KINDS).optional(),
  config: z.record(z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateMemoryBinding = z.infer<typeof updateMemoryBindingSchema>;

export const memoryOperationSchema = z.object({
  id: z.string().uuid(),
  bindingId: z.string().uuid(),
  companyId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  runId: z.string().uuid().nullable(),
  issueId: z.string().uuid().nullable(),
  op: z.enum(MEMORY_OPS),
  queryText: z.string().nullable(),
  tokensUsed: z.number().int().nullable(),
  latencyMs: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export type MemoryOperation = z.infer<typeof memoryOperationSchema>;

export const memoryQueryApiSchema = z.object({
  query: z.string().min(1).max(2000),
  topK: z.number().int().min(1).max(50).optional().default(5),
  intent: z.enum(["agent_preamble", "answer", "browse"]).optional(),
});

export type MemoryQueryApi = z.infer<typeof memoryQueryApiSchema>;

export const memoryWriteApiSchema = z.object({
  content: z.string().min(1).max(50000),
  sourceKind: z.enum(["issue_comment", "issue_document", "issue", "run", "activity", "manual_note", "external_document"]),
  metadata: z.record(z.unknown()).optional(),
  mode: z.enum(["append", "upsert", "summarize"]).optional(),
});

export type MemoryWriteApi = z.infer<typeof memoryWriteApiSchema>;
