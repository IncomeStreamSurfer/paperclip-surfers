import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, heartbeatRunEvents, heartbeatRuns } from "@paperclipai/db";
import { logger } from "../middleware/logger.js";
import { logActivity } from "./activity-log.js";

const DEFAULT_STUCK_AFTER_MINUTES = 10;
const DEFAULT_SILENCE_THRESHOLD_MINUTES = 5;

export interface WatchdogOptions {
  stuckAfterMinutes?: number;
  silenceThresholdMinutes?: number;
}

interface StuckRun {
  runId: string;
  agentId: string;
  companyId: string;
  agentName: string;
  runningMinutes: number;
  lastEventAt: Date | null;
  silenceMinutes: number | null;
}

export function heartbeatWatchdogService(
  db: Db,
  cancelRun: (runId: string, reason?: string) => Promise<unknown>,
) {
  async function findStuckRuns(
    now: Date,
    opts: WatchdogOptions = {},
  ): Promise<StuckRun[]> {
    const stuckAfterMinutes = opts.stuckAfterMinutes ?? DEFAULT_STUCK_AFTER_MINUTES;
    const silenceThresholdMinutes = opts.silenceThresholdMinutes ?? DEFAULT_SILENCE_THRESHOLD_MINUTES;

    const stuckCutoff = new Date(now.getTime() - stuckAfterMinutes * 60 * 1000);
    const silenceCutoff = new Date(now.getTime() - silenceThresholdMinutes * 60 * 1000);

    const runningRuns = await db
      .select({
        runId: heartbeatRuns.id,
        agentId: heartbeatRuns.agentId,
        companyId: heartbeatRuns.companyId,
        agentName: agents.name,
        startedAt: heartbeatRuns.startedAt,
      })
      .from(heartbeatRuns)
      .innerJoin(agents, eq(heartbeatRuns.agentId, agents.id))
      .where(
        and(
          eq(heartbeatRuns.status, "running"),
          isNotNull(heartbeatRuns.startedAt),
          lt(heartbeatRuns.startedAt, stuckCutoff),
        ),
      );

    const stuck: StuckRun[] = [];

    for (const run of runningRuns) {
      const runningMinutes = (now.getTime() - run.startedAt!.getTime()) / 60_000;

      const [latestEvent] = await db
        .select({ createdAt: heartbeatRunEvents.createdAt })
        .from(heartbeatRunEvents)
        .where(eq(heartbeatRunEvents.runId, run.runId))
        .orderBy(desc(heartbeatRunEvents.createdAt))
        .limit(1);

      const lastEventAt = latestEvent?.createdAt ?? null;
      const silenceMinutes = lastEventAt
        ? (now.getTime() - lastEventAt.getTime()) / 60_000
        : null;

      if (silenceMinutes === null || silenceMinutes >= silenceThresholdMinutes) {
        stuck.push({
          runId: run.runId,
          agentId: run.agentId,
          companyId: run.companyId,
          agentName: run.agentName,
          runningMinutes: Math.round(runningMinutes),
          lastEventAt,
          silenceMinutes: silenceMinutes !== null ? Math.round(silenceMinutes) : null,
        });
      }
    }

    return stuck;
  }

  async function checkStuckRuns(
    now = new Date(),
    opts: WatchdogOptions = {},
  ): Promise<{ stuckCount: number; pausedCount: number }> {
    const stuck = await findStuckRuns(now, opts);

    if (stuck.length === 0) return { stuckCount: 0, pausedCount: 0 };

    logger.warn(
      { stuckCount: stuck.length, details: stuck.map((s) => ({ agentId: s.agentId, runId: s.runId, runningMinutes: s.runningMinutes, silenceMinutes: s.silenceMinutes })) },
      "heartbeat watchdog detected stuck runs",
    );

    let pausedCount = 0;

    for (const run of stuck) {
      try {
        await db
          .update(agents)
          .set({
            status: "paused",
            pauseReason: "stuck",
            pausedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(agents.id, run.agentId));

        await logActivity(db, {
          companyId: run.companyId,
          actorType: "system",
          actorId: "heartbeat_watchdog",
          agentId: run.agentId,
          action: "run.stuck_detected",
          entityType: "heartbeat_run",
          entityId: run.runId,
          details: {
            agentName: run.agentName,
            runningMinutes: run.runningMinutes,
            silenceMinutes: run.silenceMinutes,
          },
        });

        await cancelRun(run.runId, `Stuck run detected — no events for ${run.silenceMinutes ?? "?"} minutes`);

        pausedCount += 1;

        logger.info(
          { agentId: run.agentId, runId: run.runId, agentName: run.agentName },
          "heartbeat watchdog paused agent and cancelled stuck run",
        );
      } catch (err) {
        logger.error(
          { err, agentId: run.agentId, runId: run.runId },
          "heartbeat watchdog failed to handle stuck run",
        );
      }
    }

    return { stuckCount: stuck.length, pausedCount };
  }

  return {
    checkStuckRuns,
    findStuckRuns,
  };
}
