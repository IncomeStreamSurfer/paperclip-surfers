import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Db } from "@paperclipai/db";
import { socialAccounts, socialPosts } from "@paperclipai/db";
import type { CreateSocialAccount, UpdateSocialAccount, CreateSocialPost, UpdateSocialPost } from "@paperclipai/shared";

export function socialMediaService(db: Db) {
  return {
    // ---- Accounts ----

    listAccounts: (companyId: string) =>
      db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.companyId, companyId))
        .orderBy(asc(socialAccounts.platform), asc(socialAccounts.handle)),

    getAccountById: (id: string) =>
      db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, id))
        .then((rows) => rows[0] ?? null),

    createAccount: (companyId: string, data: CreateSocialAccount) => {
      const now = new Date();
      return db
        .insert(socialAccounts)
        .values({ id: randomUUID(), companyId, ...data, createdAt: now, updatedAt: now })
        .returning()
        .then((rows) => rows[0]);
    },

    updateAccount: (id: string, data: UpdateSocialAccount) =>
      db
        .update(socialAccounts)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(socialAccounts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deleteAccount: (id: string) =>
      db
        .delete(socialAccounts)
        .where(eq(socialAccounts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    // ---- Posts ----

    listPosts: async (companyId: string, filters?: { status?: string; accountId?: string }) => {
      const conditions = [eq(socialPosts.companyId, companyId)];
      if (filters?.status) {
        // Type-safe cast — caller validates via zod
        conditions.push(eq(socialPosts.status, filters.status as typeof socialPosts.status._.data));
      }
      if (filters?.accountId) {
        conditions.push(eq(socialPosts.accountId, filters.accountId));
      }

      const posts = await db
        .select()
        .from(socialPosts)
        .where(and(...conditions))
        .orderBy(desc(socialPosts.updatedAt));

      if (!posts.length) return posts;

      // Join account info
      const accountIds = [...new Set(posts.map((p) => p.accountId).filter(Boolean))] as string[];
      const accounts = accountIds.length
        ? await db
            .select({
              id: socialAccounts.id,
              platform: socialAccounts.platform,
              handle: socialAccounts.handle,
              displayName: socialAccounts.displayName,
              profileImageUrl: socialAccounts.profileImageUrl,
            })
            .from(socialAccounts)
            .where(inArray(socialAccounts.id, accountIds))
        : [];

      const accountMap = new Map(accounts.map((a) => [a.id, a]));
      return posts.map((p) => ({
        ...p,
        account: p.accountId ? (accountMap.get(p.accountId) ?? null) : null,
      }));
    },

    getPostById: async (id: string) => {
      const post = await db
        .select()
        .from(socialPosts)
        .where(eq(socialPosts.id, id))
        .then((rows) => rows[0] ?? null);

      if (!post) return null;

      const account = post.accountId
        ? await db
            .select({
              id: socialAccounts.id,
              platform: socialAccounts.platform,
              handle: socialAccounts.handle,
              displayName: socialAccounts.displayName,
              profileImageUrl: socialAccounts.profileImageUrl,
            })
            .from(socialAccounts)
            .where(eq(socialAccounts.id, post.accountId))
            .then((rows) => rows[0] ?? null)
        : null;

      return { ...post, account };
    },

    createPost: (companyId: string, data: CreateSocialPost, createdBy?: string) => {
      const now = new Date();
      return db
        .insert(socialPosts)
        .values({
          id: randomUUID(),
          companyId,
          accountId: data.accountId ?? null,
          title: data.title,
          body: data.body ?? "",
          status: data.status ?? "draft",
          scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          data: data.data ?? null,
          createdBy: createdBy ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updatePost: (id: string, data: UpdateSocialPost) =>
      db
        .update(socialPosts)
        .set({
          ...(data.accountId !== undefined && { accountId: data.accountId }),
          ...(data.title !== undefined && { title: data.title }),
          ...(data.body !== undefined && { body: data.body }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.scheduledAt !== undefined && {
            scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
          }),
          ...(data.data !== undefined && { data: data.data }),
          updatedAt: new Date(),
        })
        .where(eq(socialPosts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),

    deletePost: (id: string) =>
      db
        .delete(socialPosts)
        .where(eq(socialPosts.id, id))
        .returning()
        .then((rows) => rows[0] ?? null),
  };
}
