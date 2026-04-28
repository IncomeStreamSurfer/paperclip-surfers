import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { designAssets } from "@paperclipai/db";
import { eq, and, desc } from "drizzle-orm";
import type { UpdateDesignAsset } from "@paperclipai/shared";

export function designService(db: Db) {
  return {
    list: (
      companyId: string,
      filters?: { status?: string; style?: string; limit?: number; offset?: number },
    ) => {
      const conditions = [eq(designAssets.companyId, companyId)];
      if (filters?.status) {
        conditions.push(
          eq(designAssets.status, filters.status as typeof designAssets.status._.data),
        );
      }
      if (filters?.style) {
        conditions.push(
          eq(designAssets.style, filters.style as typeof designAssets.style._.data),
        );
      }
      return db
        .select()
        .from(designAssets)
        .where(and(...conditions))
        .orderBy(desc(designAssets.createdAt))
        .limit(filters?.limit ?? 50)
        .offset(filters?.offset ?? 0);
    },

    getById: (id: string) =>
      db
        .select()
        .from(designAssets)
        .where(eq(designAssets.id, id))
        .then((rows) => rows[0] ?? null),

    /** Create a placeholder record in "generating" state before kicking off ComfyUI. */
    createPending: (
      companyId: string,
      data: {
        title: string;
        prompt: string;
        expandedPrompt?: string | null;
        style: string;
        width: number;
        height: number;
        steps: number;
        cfg: number;
        seed?: number | null;
      },
    ) => {
      const now = new Date();
      return db
        .insert(designAssets)
        .values({
          id: randomUUID(),
          companyId,
          title: data.title,
          prompt: data.prompt,
          expandedPrompt: data.expandedPrompt ?? null,
          style: data.style,
          width: data.width,
          height: data.height,
          steps: data.steps,
          cfg: data.cfg,
          seed: data.seed ?? null,
          status: "generating",
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    markDone: (
      id: string,
      data: { checkpointUsed: string; assetId: string; imageUrl: string; seed: number },
    ) =>
      db
        .update(designAssets)
        .set({
          status: "done",
          checkpointUsed: data.checkpointUsed,
          assetId: data.assetId,
          imageUrl: data.imageUrl,
          seed: data.seed,
          updatedAt: new Date(),
        })
        .where(eq(designAssets.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    markFailed: (id: string, errorMessage: string) =>
      db
        .update(designAssets)
        .set({ status: "failed", errorMessage, updatedAt: new Date() })
        .where(eq(designAssets.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    update: (id: string, data: UpdateDesignAsset) =>
      db
        .update(designAssets)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(designAssets.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    delete: (id: string) =>
      db
        .delete(designAssets)
        .where(eq(designAssets.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    countByStatus: (companyId: string) =>
      db
        .select()
        .from(designAssets)
        .where(eq(designAssets.companyId, companyId))
        .then((rows) => {
          const counts: Record<string, number> = {
            pending: 0,
            generating: 0,
            done: 0,
            failed: 0,
          };
          for (const row of rows) {
            counts[row.status] = (counts[row.status] ?? 0) + 1;
          }
          return counts;
        }),
  };
}
