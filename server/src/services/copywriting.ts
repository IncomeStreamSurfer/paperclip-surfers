import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { copywritingBriefs } from "@paperclipai/db";
import type {
  CreateCopywritingBrief,
  UpdateCopywritingBrief,
  CopywritingBrief,
} from "@paperclipai/shared";

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://192.168.68.230:11434").replace(/\/$/, "");
const COPY_MODEL = process.env.COPY_MODEL ?? process.env.DEFAULT_MODEL ?? "dagbs/deepseek-coder-v2-lite-instruct:latest";
const COPY_TIMEOUT_MS = parseInt(process.env.COPY_GENERATE_TIMEOUT_MS ?? "180000", 10);

function contentTypeLabel(type: string): string {
  const map: Record<string, string> = {
    "blog-post": "blog post",
    "article": "long-form article",
    "social-post": "social media post",
    "email": "email",
    "landing-page": "landing page",
    "product-description": "product description",
    "press-release": "press release",
    "whitepaper": "whitepaper",
    "case-study": "case study",
    "newsletter": "newsletter",
    "ad-copy": "advertising copy",
    "other": "piece of content",
  };
  return map[type] ?? type;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function generateViaOllama(brief: CopywritingBrief): Promise<string> {
  const typeLabel = contentTypeLabel(brief.contentType);
  const wordTarget = brief.wordCountTarget ? ` (target: ~${brief.wordCountTarget} words)` : "";
  const keywordLine = brief.targetKeyword ? `\n- Target keyword: ${brief.targetKeyword}` : "";
  const audienceLine = brief.targetAudience ? `\n- Target audience: ${brief.targetAudience}` : "";

  const systemPrompt =
    "You are a professional content writer. " +
    "Write well-structured, engaging content in Markdown format. " +
    "Use headers, bullet points, and paragraphs appropriately. " +
    "Respond with ONLY the content — no preamble, no meta-commentary.";

  const userPrompt =
    `Write a ${typeLabel}${wordTarget} based on the following brief:\n\n` +
    `**Title:** ${brief.title}` +
    keywordLine +
    audienceLine +
    (brief.brief ? `\n\n**Brief:**\n${brief.brief}` : "") +
    (brief.notes ? `\n\n**Additional notes:**\n${brief.notes}` : "");

  const resp = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: COPY_MODEL,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(COPY_TIMEOUT_MS),
  });

  if (!resp.ok) throw new Error(`Ollama request failed (HTTP ${resp.status})`);

  const data = (await resp.json()) as { message?: { content?: string }; error?: string };
  const content = data.message?.content?.trim();
  if (!content) throw new Error(data.error ?? "Ollama returned empty response");
  return content;
}

export function copywritingService(db: Db) {
  return {
    listBriefs: (companyId: string, filters?: { status?: string; contentType?: string }) => {
      const conditions = [eq(copywritingBriefs.companyId, companyId)];
      if (filters?.status) {
        conditions.push(
          eq(
            copywritingBriefs.status,
            filters.status as typeof copywritingBriefs.status._.data,
          ),
        );
      }
      if (filters?.contentType) {
        conditions.push(
          eq(
            copywritingBriefs.contentType,
            filters.contentType as typeof copywritingBriefs.contentType._.data,
          ),
        );
      }
      return db
        .select()
        .from(copywritingBriefs)
        .where(and(...conditions))
        .orderBy(desc(copywritingBriefs.updatedAt));
    },

    getBriefById: (id: string) =>
      db
        .select()
        .from(copywritingBriefs)
        .where(eq(copywritingBriefs.id, id))
        .then((rows) => rows[0] ?? null),

    createBrief: (companyId: string, data: CreateCopywritingBrief) => {
      const now = new Date();
      return db
        .insert(copywritingBriefs)
        .values({
          id: randomUUID(),
          companyId,
          title: data.title,
          contentType: data.contentType ?? "blog-post",
          status: data.status ?? "draft",
          targetKeyword: data.targetKeyword ?? null,
          targetAudience: data.targetAudience ?? null,
          wordCountTarget: data.wordCountTarget ?? null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          assignedAgentId: data.assignedAgentId ?? null,
          brief: data.brief ?? null,
          notes: data.notes ?? null,
          generatedContent: null,
          generatedWordCount: null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updateBrief: (id: string, data: UpdateCopywritingBrief) => {
      const patch: Record<string, unknown> = { ...data, updatedAt: new Date() };
      if (data.dueDate !== undefined) {
        patch.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      }
      return db
        .update(copywritingBriefs)
        .set(patch)
        .where(eq(copywritingBriefs.id, id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    deleteBrief: (id: string) =>
      db
        .delete(copywritingBriefs)
        .where(eq(copywritingBriefs.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    generateBriefContent: async (brief: CopywritingBrief) => {
      const content = await generateViaOllama(brief);
      const wordCount = countWords(content);
      return { content, wordCount };
    },
  };
}
