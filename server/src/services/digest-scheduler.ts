/**
 * Digest email scheduler.
 *
 * Runs an hourly tick. At 08:00 UTC each day it sends daily digests to all
 * users who have opted in (`emailDigest: "daily"`). At 08:00 UTC every Monday
 * it additionally sends weekly digests to users opted in for `"weekly"`.
 *
 * Uses a simple `setInterval`-based approach — no external cron library needed.
 */

import { eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authUsers, userProfiles } from "@paperclipai/db";
import { emailService } from "./email.js";
import { logger } from "../middleware/logger.js";

const TICK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DIGEST_HOUR_UTC = 8; // send at 08:00 UTC

/** Return all userIds whose emailDigest preference matches `digestType`. */
async function getUsersForDigest(
  db: Db,
  digestType: "daily" | "weekly",
): Promise<string[]> {
  const rows = await db
    .select({ userId: authUsers.id, preferences: userProfiles.preferences })
    .from(authUsers)
    .leftJoin(userProfiles, eq(userProfiles.userId, authUsers.id));

  return rows
    .filter((r) => r.preferences?.notifications?.emailDigest === digestType)
    .map((r) => r.userId);
}

async function runDigestTick(db: Db): Promise<void> {
  const now = new Date();
  const hour = now.getUTCHours();
  const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 1 = Monday

  if (hour !== DIGEST_HOUR_UTC) return;

  const svc = emailService(db);

  // Daily digest — every day at 08:00 UTC
  const dailyUsers = await getUsersForDigest(db, "daily");
  for (const userId of dailyUsers) {
    try {
      await svc.sendDigestEmail(userId, "daily");
    } catch (err) {
      logger.error({ err, userId }, "Failed to send daily digest email");
    }
  }

  // Weekly digest — only on Mondays at 08:00 UTC
  if (dayOfWeek === 1) {
    const weeklyUsers = await getUsersForDigest(db, "weekly");
    for (const userId of weeklyUsers) {
      try {
        await svc.sendDigestEmail(userId, "weekly");
      } catch (err) {
        logger.error({ err, userId }, "Failed to send weekly digest email");
      }
    }
  }
}

/**
 * Start the digest scheduler. Returns a `stop()` function to cancel the
 * interval (useful for clean shutdown).
 */
export function startDigestScheduler(db: Db): { stop: () => void } {
  // Run an initial tick shortly after startup (avoids missing the window if the
  // server restarts right at 08:00 UTC).
  void runDigestTick(db).catch((err) => {
    logger.error({ err }, "Digest scheduler: initial tick failed");
  });

  const handle = setInterval(() => {
    void runDigestTick(db).catch((err) => {
      logger.error({ err }, "Digest scheduler: tick failed");
    });
  }, TICK_INTERVAL_MS);

  return {
    stop: () => clearInterval(handle),
  };
}
