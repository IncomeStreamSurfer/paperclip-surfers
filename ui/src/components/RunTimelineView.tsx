import { useMemo } from "react";
import type { HeartbeatRun, HeartbeatRunEvent } from "@paperclipai/shared";
import { cn } from "../lib/utils";

interface TimelinePhase {
  label: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  color: string;
  detail?: string;
  subPhases?: TimelinePhase[];
}

function parsePhases(run: HeartbeatRun, events: HeartbeatRunEvent[]): TimelinePhase[] {
  const phases: TimelinePhase[] = [];
  const base = new Date(run.createdAt).getTime();

  // Queued phase
  if (run.startedAt) {
    const queuedEnd = new Date(run.startedAt).getTime();
    const queueDuration = queuedEnd - base;
    if (queueDuration > 100) {
      phases.push({
        label: "Queued",
        startMs: base,
        endMs: queuedEnd,
        durationMs: queueDuration,
        color: "bg-neutral-300 dark:bg-neutral-700",
        detail: `${(queueDuration / 1000).toFixed(1)}s`,
      });
    }
  }

  const runStart = run.startedAt ? new Date(run.startedAt).getTime() : base;
  const runEnd = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();

  // Find key events
  const adapterInvokeEvent = events.find((e) => e.eventType === "adapter.invoke");
  const completionEvent = [...events]
    .reverse()
    .find((e) => e.eventType === "lifecycle" && (e.payload?.status != null || e.message?.includes("completed") || e.message?.includes("succeeded") || e.message?.includes("failed") || e.message?.includes("cancelled") || e.message?.includes("timed_out")));
  const errorEvent = events.find((e) => e.eventType === "error");

  // Setup phase: run started → adapter invoke
  const adapterStartMs = adapterInvokeEvent ? new Date(adapterInvokeEvent.createdAt).getTime() : null;
  if (adapterStartMs && adapterStartMs > runStart) {
    phases.push({
      label: "Context Build",
      startMs: runStart,
      endMs: adapterStartMs,
      durationMs: adapterStartMs - runStart,
      color: "bg-blue-300 dark:bg-blue-700",
      detail: `${((adapterStartMs - runStart) / 1000).toFixed(1)}s`,
    });
  }

  // Adapter execution phase
  const adapterEndMs = completionEvent
    ? new Date(completionEvent.createdAt).getTime()
    : errorEvent
      ? new Date(errorEvent.createdAt).getTime()
      : runEnd;

  if (adapterStartMs) {
    // Find tool call events from log parsing
    const toolCallEvents = events.filter(
      (e) => e.eventType === "lifecycle" && e.payload?.toolName
    );

    const subPhases: TimelinePhase[] = toolCallEvents.map((e, i) => {
      const ts = new Date(e.createdAt).getTime();
      const nextTs = toolCallEvents[i + 1]
        ? new Date(toolCallEvents[i + 1].createdAt).getTime()
        : adapterEndMs;
      return {
        label: String(e.payload?.toolName ?? "tool"),
        startMs: ts,
        endMs: nextTs,
        durationMs: nextTs - ts,
        color: "bg-emerald-200 dark:bg-emerald-800",
      };
    });

    phases.push({
      label: "Adapter Execution",
      startMs: adapterStartMs,
      endMs: adapterEndMs,
      durationMs: adapterEndMs - adapterStartMs,
      color: "bg-emerald-300 dark:bg-emerald-700",
      detail: `${((adapterEndMs - adapterStartMs) / 1000).toFixed(1)}s`,
      subPhases: subPhases.length > 0 ? subPhases : undefined,
    });
  } else {
    // No adapter invoke event, just show the whole execution as one phase
    const executionEndMs = completionEvent
      ? new Date(completionEvent.createdAt).getTime()
      : runEnd;
    if (executionEndMs > runStart) {
      phases.push({
        label: "Execution",
        startMs: runStart,
        endMs: executionEndMs,
        durationMs: executionEndMs - runStart,
        color: "bg-emerald-300 dark:bg-emerald-700",
        detail: `${((executionEndMs - runStart) / 1000).toFixed(1)}s`,
      });
    }
  }

  // Post-processing phase
  const postStartMs = completionEvent || errorEvent
    ? Math.max(
        adapterEndMs,
        (completionEvent ? new Date(completionEvent.createdAt).getTime() : 0),
        (errorEvent ? new Date(errorEvent.createdAt).getTime() : 0),
      )
    : adapterEndMs;

  if (run.finishedAt) {
    const postEndMs = new Date(run.finishedAt).getTime();
    if (postEndMs > postStartMs) {
      phases.push({
        label: "Post-Processing",
        startMs: postStartMs,
        endMs: postEndMs,
        durationMs: postEndMs - postStartMs,
        color: "bg-violet-300 dark:bg-violet-700",
        detail: `${((postEndMs - postStartMs) / 1000).toFixed(1)}s`,
      });
    }
  }

  return phases;
}

export function RunTimelineView({
  run,
  events,
}: {
  run: HeartbeatRun;
  events: HeartbeatRunEvent[];
}) {
  const phases = useMemo(() => parsePhases(run, events), [run, events]);

  if (phases.length === 0) return null;

  const totalMs = Math.max(
    ...phases.map((p) => p.endMs),
  ) - Math.min(...phases.map((p) => p.startMs));

  if (totalMs <= 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Timeline</div>
      <div className="relative w-full h-8 bg-neutral-100 dark:bg-neutral-900 rounded-lg overflow-hidden">
        {phases.map((phase, i) => {
          const leftPct = ((phase.startMs - phases[0].startMs) / totalMs) * 100;
          const widthPct = (phase.durationMs / totalMs) * 100;
          return (
            <div
              key={i}
              className={cn(
                "absolute top-0 h-full transition-all hover:opacity-80 cursor-pointer group",
                phase.color,
              )}
              style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 2)}%` }}
              title={`${phase.label}: ${(phase.durationMs / 1000).toFixed(1)}s`}
            >
              {widthPct > 8 && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-white/80 truncate px-1">
                  {phase.label}
                </span>
              )}
              {phase.subPhases && phase.subPhases.length > 0 && (
                <div className="absolute inset-0 flex">
                  {phase.subPhases.map((sub, j) => {
                    const subLeft = ((sub.startMs - phase.startMs) / phase.durationMs) * 100;
                    const subWidth = (sub.durationMs / phase.durationMs) * 100;
                    return (
                      <div
                        key={j}
                        className={cn("h-full", sub.color)}
                        style={{ marginLeft: j === 0 ? `${subLeft}%` : 0, width: `${Math.max(subWidth, 1)}%` }}
                        title={`${sub.label}: ${(sub.durationMs / 1000).toFixed(1)}s`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {phases.map((phase, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={cn("w-2.5 h-2.5 rounded-sm", phase.color)} />
            <span className="text-[11px] text-muted-foreground">
              {phase.label}
              {phase.detail && <span className="ml-1 font-mono">({phase.detail})</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
