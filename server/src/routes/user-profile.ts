import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authSessions, userProfiles } from "@paperclipai/db";
import type { UserPreferences } from "@paperclipai/db";

export function userProfileRoutes(db: Db): Router {
  const router = Router();

  /** GET /user/profile — get the current user's extended profile */
  router.get("/user/profile", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.actor.userId;

    const row = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .then((rows) => rows[0] ?? null);

    if (!row) {
      res.json({ userId, bio: null, phone: null, jobTitle: null, location: null, preferences: null });
      return;
    }
    res.json(row);
  });

  /** PATCH /user/profile — upsert the current user's extended profile (partial update) */
  router.patch("/user/profile", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.actor.userId;

    const body = req.body as {
      bio?: string | null;
      phone?: string | null;
      jobTitle?: string | null;
      location?: string | null;
      preferences?: UserPreferences | null;
    };

    // Read the existing row so we can do a true partial update — only
    // overwrite columns that are explicitly present in the request body.
    const existing = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .then((rows) => rows[0] ?? null);

    const merged = {
      bio:         "bio"         in body ? (body.bio         ?? null) : (existing?.bio         ?? null),
      phone:       "phone"       in body ? (body.phone       ?? null) : (existing?.phone       ?? null),
      jobTitle:    "jobTitle"    in body ? (body.jobTitle    ?? null) : (existing?.jobTitle    ?? null),
      location:    "location"   in body ? (body.location    ?? null) : (existing?.location    ?? null),
      preferences: "preferences" in body ? (body.preferences ?? null) : (existing?.preferences ?? null),
    };

    const now = new Date();
    await db
      .insert(userProfiles)
      .values({
        userId,
        ...merged,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...merged,
          updatedAt: now,
        },
      });

    const updated = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .then((rows) => rows[0]);

    res.json(updated);
  });

  /** GET /user/sessions — list active sessions for the current user */
  router.get("/user/sessions", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.actor.userId;
    const rows = await db
      .select({
        id: authSessions.id,
        createdAt: authSessions.createdAt,
        expiresAt: authSessions.expiresAt,
        ipAddress: authSessions.ipAddress,
        userAgent: authSessions.userAgent,
      })
      .from(authSessions)
      .where(eq(authSessions.userId, userId));
    res.json({ sessions: rows });
  });

  /** DELETE /user/sessions/:id — revoke a specific session */
  router.delete("/user/sessions/:id", async (req, res) => {
    if (req.actor.type !== "board" || !req.actor.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    const userId = req.actor.userId;
    const sessionId = req.params.id;

    // Only allow deleting own sessions
    const session = await db
      .select({ id: authSessions.id })
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .then((rows) => rows[0] ?? null);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Verify ownership via token match — userId is on the session row
    const owned = await db
      .select({ userId: authSessions.userId })
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .then((rows) => rows[0] ?? null);

    if (owned?.userId !== userId) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    await db.delete(authSessions).where(eq(authSessions.id, sessionId));
    res.json({ ok: true });
  });

  return router;
}
