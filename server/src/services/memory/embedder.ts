import { logger } from "../../middleware/logger.js";

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://192.168.68.230:11434").replace(/\/$/, "");
const DEFAULT_EMBED_MODEL = "nomic-embed-text:latest";

export async function embedTexts(texts: string[], model = DEFAULT_EMBED_MODEL): Promise<number[][]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: texts }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Ollama embed failed: ${resp.status} ${text}`);
    }
    const data = (await resp.json()) as { embeddings: number[][] };
    return data.embeddings;
  } catch (err) {
    logger.warn({ err, model, count: texts.length }, "Embedding failed");
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function embedText(text: string, model?: string): Promise<number[]> {
  const embeddings = await embedTexts([text], model);
  return embeddings[0];
}
