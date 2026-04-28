import { ChromaClient } from "chromadb";
import { logger } from "../middleware/logger.js";

let client: ChromaClient | null = null;

export function getChromaClient(): ChromaClient | null {
  if (client) return client;
  const host = process.env.CHROMA_HOST;
  if (!host) {
    logger.warn("CHROMA_HOST not set — knowledge base features disabled");
    return null;
  }
  try {
    client = new ChromaClient({ path: host });
    return client;
  } catch (err) {
    logger.warn({ err }, "Failed to create ChromaDB client");
    return null;
  }
}

export async function ensureCollection(name: string) {
  const chroma = getChromaClient();
  if (!chroma) return null;
  try {
    return await chroma.getOrCreateCollection({ name, metadata: { createdBy: "paperclip" } });
  } catch (err) {
    logger.warn({ err, name }, "Failed to get/create Chroma collection");
    return null;
  }
}

export async function deleteCollection(name: string) {
  const chroma = getChromaClient();
  if (!chroma) return;
  try {
    await chroma.deleteCollection({ name });
  } catch (err) {
    logger.warn({ err, name }, "Failed to delete Chroma collection");
  }
}
