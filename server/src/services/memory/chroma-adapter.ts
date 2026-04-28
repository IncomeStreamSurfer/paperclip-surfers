import type {
  MemoryAdapter,
  MemoryAdapterCapabilities,
  MemoryScopeInput,
  MemorySourceRef,
  MemoryWriteRequest,
  MemoryQueryRequest,
  MemoryContextBundle,
  MemorySnippet,
  MemoryRecordHandle,
  MemoryUsage,
} from "@paperclipai/shared";
import { getChromaClient, ensureCollection } from "../chroma-client.js";
import { logger } from "../../middleware/logger.js";
import { embedTexts, embedText } from "./embedder.js";

export interface ChromaMemoryAdapterOptions {
  companyId: string;
  scope: "company" | "agent" | "project" | "issue";
  scopeId?: string;
  topK?: number;
  minScore?: number;
}

function chunkText(text: string, chunkSize = 512, overlap = 64): string[] {
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

function collectionName(companyId: string, scope: string, scopeId?: string): string {
  const suffix = scopeId ? `_${scopeId.slice(0, 8)}` : "";
  return `mp_${companyId.slice(0, 8)}_${scope}${suffix}`;
}

function sourceToMetadata(source: MemorySourceRef): Record<string, string | undefined> {
  return {
    source_kind: source.kind,
    source_companyId: source.companyId,
    source_issueId: source.issueId,
    source_commentId: source.commentId,
    source_documentKey: source.documentKey,
    source_runId: source.runId,
    source_activityId: source.activityId,
    source_externalRef: source.externalRef,
  };
}

export class ChromaMemoryAdapter implements MemoryAdapter {
  key = "chroma";
  capabilities: MemoryAdapterCapabilities = {
    asyncIngestion: true,
    profile: false,
    browse: false,
    correction: false,
    multimodal: false,
    providerManagedExtraction: false,
  };

  private companyId: string;
  private scope: string;
  private scopeId?: string;
  private defaultTopK: number;
  private minScore: number;

  constructor(opts: ChromaMemoryAdapterOptions) {
    this.companyId = opts.companyId;
    this.scope = opts.scope;
    this.scopeId = opts.scopeId;
    this.defaultTopK = opts.topK ?? 5;
    this.minScore = opts.minScore ?? 0.0;
  }

  private getCollectionName(): string {
    return collectionName(this.companyId, this.scope, this.scopeId);
  }

  private async getCollection() {
    const name = this.getCollectionName();
    return ensureCollection(name);
  }

  async write(req: MemoryWriteRequest): Promise<{ records?: MemoryRecordHandle[]; usage?: MemoryUsage[] }> {
    const start = Date.now();
    const collection = await this.getCollection();
    if (!collection) {
      throw new Error("ChromaDB unavailable");
    }

    const chunks = chunkText(req.content, 512, 64);
    const embeddings = await embedTexts(chunks);
    const ids = chunks.map((_, i) => `${req.source.kind}_${req.source.runId ?? req.source.commentId ?? req.source.activityId ?? Date.now()}_${i}`);
    const metadatas = chunks.map(() => ({
      ...sourceToMetadata(req.source),
      binding_key: req.bindingKey,
    }));

    await collection.add({
      ids,
      documents: chunks,
      embeddings,
      metadatas,
    });

    const latencyMs = Date.now() - start;
    const records: MemoryRecordHandle[] = ids.map((id) => ({
      providerKey: this.key,
      providerRecordId: id,
    }));

    return {
      records,
      usage: [
        {
          provider: this.key,
          model: "nomic-embed-text",
          embeddingTokens: req.content.length / 4,
          latencyMs,
        },
      ],
    };
  }

  async query(req: MemoryQueryRequest): Promise<MemoryContextBundle> {
    const start = Date.now();
    const collection = await this.getCollection();
    if (!collection) {
      return { snippets: [] };
    }

    const queryEmbedding = await embedText(req.query);
    const topK = req.topK ?? this.defaultTopK;

    const results = await collection.query({
      queryEmbeddings: [queryEmbedding],
      nResults: topK,
      ...(req.metadataFilter ? { where: req.metadataFilter as unknown as Parameters<typeof collection.query>[0]["where"] } : {}),
    });

    const latencyMs = Date.now() - start;
    const snippets: MemorySnippet[] = [];

    if (results.documents && results.documents[0]) {
      for (let i = 0; i < results.documents[0].length; i++) {
        const distance = results.distances?.[0]?.[i];
        const score = distance != null ? 1 - distance : undefined;
        if (score !== undefined && score < this.minScore) continue;

        const docId = results.ids[0][i];
        const metadata = results.metadatas?.[0]?.[i] as Record<string, string> | undefined;

        snippets.push({
          handle: { providerKey: this.key, providerRecordId: docId },
          text: results.documents[0][i] ?? "",
          score,
          source: metadata
            ? {
                kind: (metadata.source_kind as MemorySourceRef["kind"]) ?? "manual_note",
                companyId: metadata.source_companyId ?? this.companyId,
                issueId: metadata.source_issueId,
                commentId: metadata.source_commentId,
                documentKey: metadata.source_documentKey,
                runId: metadata.source_runId,
                activityId: metadata.source_activityId,
                externalRef: metadata.source_externalRef,
              }
            : undefined,
          metadata: metadata ? { bindingKey: metadata.binding_key } : undefined,
        });
      }
    }

    return {
      snippets,
      usage: [
        {
          provider: this.key,
          model: "nomic-embed-text",
          embeddingTokens: req.query.length / 4,
          latencyMs,
        },
      ],
    };
  }

  async get(handle: MemoryRecordHandle, _scope: MemoryScopeInput): Promise<MemorySnippet | null> {
    const collection = await this.getCollection();
    if (!collection) return null;

    try {
      const result = await collection.get({
        ids: [handle.providerRecordId],
      });
      if (!result.documents?.[0]) return null;

      const metadata = result.metadatas?.[0] as Record<string, string> | undefined;
      return {
        handle,
        text: result.documents[0],
        source: metadata
          ? {
              kind: (metadata.source_kind as MemorySourceRef["kind"]) ?? "manual_note",
              companyId: metadata.source_companyId ?? this.companyId,
              issueId: metadata.source_issueId,
              commentId: metadata.source_commentId,
              documentKey: metadata.source_documentKey,
              runId: metadata.source_runId,
              activityId: metadata.source_activityId,
              externalRef: metadata.source_externalRef,
            }
          : undefined,
        metadata: metadata ? { bindingKey: metadata.binding_key } : undefined,
      };
    } catch (err) {
      logger.warn({ err, handle }, "ChromaMemoryAdapter.get failed");
      return null;
    }
  }

  async forget(handles: MemoryRecordHandle[], _scope: MemoryScopeInput): Promise<{ usage?: MemoryUsage[] }> {
    const collection = await this.getCollection();
    if (!collection) return {};

    const ids = handles.filter((h) => h.providerKey === this.key).map((h) => h.providerRecordId);
    if (ids.length === 0) return {};

    await collection.delete({ ids });
    return {
      usage: [{ provider: this.key, latencyMs: 0 }],
    };
  }

  async getUsage(): Promise<{ chunkCount: number; embeddingModel: string }> {
    const collection = await this.getCollection();
    if (!collection) return { chunkCount: 0, embeddingModel: "nomic-embed-text" };
    try {
      const count = await collection.count();
      return { chunkCount: count, embeddingModel: "nomic-embed-text" };
    } catch {
      return { chunkCount: 0, embeddingModel: "nomic-embed-text" };
    }
  }
}
