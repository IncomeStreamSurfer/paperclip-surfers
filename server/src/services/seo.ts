import { and, asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { seoKeywords, seoPages } from "@paperclipai/db";
import type {
  CreateSeoKeyword,
  UpdateSeoKeyword,
  CreateSeoPage,
  UpdateSeoPage,
} from "@paperclipai/shared";

export function seoService(db: Db) {
  return {
    // ---- Keywords ----

    listKeywords: (companyId: string) =>
      db
        .select()
        .from(seoKeywords)
        .where(eq(seoKeywords.companyId, companyId))
        .orderBy(asc(seoKeywords.keyword)),

    getKeywordById: (id: string) =>
      db
        .select()
        .from(seoKeywords)
        .where(eq(seoKeywords.id, id))
        .then((rows) => rows[0] ?? null),

    createKeyword: (companyId: string, data: CreateSeoKeyword) => {
      const now = new Date();
      return db
        .insert(seoKeywords)
        .values({ id: randomUUID(), companyId, ...data, createdAt: now, updatedAt: now })
        .returning()
        .then((rows) => rows[0]);
    },

    updateKeyword: (id: string, data: UpdateSeoKeyword) =>
      db
        .update(seoKeywords)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(seoKeywords.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deleteKeyword: (id: string) =>
      db
        .delete(seoKeywords)
        .where(eq(seoKeywords.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ---- Pages ----

    listPages: (companyId: string, filters?: { status?: string }) => {
      const conditions: ReturnType<typeof eq>[] = [eq(seoPages.companyId, companyId)];
      if (filters?.status) {
        conditions.push(
          eq(seoPages.status, filters.status as typeof seoPages.status._.data),
        );
      }
      return db
        .select()
        .from(seoPages)
        .where(and(...conditions))
        .orderBy(desc(seoPages.updatedAt));
    },

    getPageById: (id: string) =>
      db
        .select()
        .from(seoPages)
        .where(eq(seoPages.id, id))
        .then((rows) => rows[0] ?? null),

    createPage: (companyId: string, data: CreateSeoPage) => {
      const now = new Date();
      return db
        .insert(seoPages)
        .values({ id: randomUUID(), companyId, ...data, createdAt: now, updatedAt: now })
        .returning()
        .then((rows) => rows[0]);
    },

    updatePage: (id: string, data: UpdateSeoPage) =>
      db
        .update(seoPages)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(seoPages.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deletePage: (id: string) =>
      db
        .delete(seoPages)
        .where(eq(seoPages.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
