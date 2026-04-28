import { useState, useEffect, useRef } from "react";
import type { HeartbeatRun, TokenUsageSummary, BurndownSummary, TasksByAgentSummary, AgentTimeSummary, IssuesByProjectSummary, CycleTimeSummary, CostTrendSummary, ProjectHealthSummary } from "@paperclipai/shared";
import type { Sprint } from "../api/sprints";
import { Link } from "@/lib/router";
import { Globe, Plus, X, ChevronUp, ChevronDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useTimezones,
  formatTzDateTime,
  searchTimezones,
  type SearchResult,
} from "../hooks/useTimezones";

/* ---- Utilities ---- */

export function getLast14Days(): string[] {
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/* ---- Sub-components ---- */

function DateLabels({ days }: { days: string[] }) {
  return (
    <div className="flex gap-[3px] mt-1.5">
      {days.map((day, i) => (
        <div key={day} className="flex-1 text-center">
          {(i === 0 || i === 6 || i === 13) ? (
            <span className="text-[9px] text-muted-foreground tabular-nums">{formatDayLabel(day)}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 mt-2">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {subtitle && <span className="text-[10px] text-muted-foreground/60">{subtitle}</span>}
      </div>
      {children}
    </div>
  );
}

/* ---- Chart Components ---- */

export function RunActivityChart({ runs }: { runs: HeartbeatRun[] }) {
  const days = getLast14Days();

  const grouped = new Map<string, { succeeded: number; failed: number; other: number }>();
  for (const day of days) grouped.set(day, { succeeded: 0, failed: 0, other: 0 });
  for (const run of runs) {
    const day = new Date(run.createdAt).toISOString().slice(0, 10);
    const entry = grouped.get(day);
    if (!entry) continue;
    if (run.status === "succeeded") entry.succeeded++;
    else if (run.status === "failed" || run.status === "timed_out") entry.failed++;
    else entry.other++;
  }

  const maxValue = Math.max(...Array.from(grouped.values()).map(v => v.succeeded + v.failed + v.other), 1);
  const hasData = Array.from(grouped.values()).some(v => v.succeeded + v.failed + v.other > 0);

  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map(day => {
          const entry = grouped.get(day)!;
          const total = entry.succeeded + entry.failed + entry.other;
          const heightPct = (total / maxValue) * 100;
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex flex-col justify-end">
                  {total > 0 ? (
                    <div className="flex flex-col-reverse gap-px overflow-hidden" style={{ height: `${heightPct}%`, minHeight: 2 }}>
                      {entry.succeeded > 0 && <div className="bg-emerald-500" style={{ flex: entry.succeeded }} />}
                      {entry.failed > 0 && <div className="bg-red-500" style={{ flex: entry.failed }} />}
                      {entry.other > 0 && <div className="bg-neutral-500" style={{ flex: entry.other }} />}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day}: {total} runs
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <DateLabels days={days} />
    </div>
  );
}

const priorityColors: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#6b7280",
};

const priorityOrder = ["critical", "high", "medium", "low"] as const;

export function PriorityChart({ issues }: { issues: { priority: string; createdAt: Date }[] }) {
  const days = getLast14Days();
  const grouped = new Map<string, Record<string, number>>();
  for (const day of days) grouped.set(day, { critical: 0, high: 0, medium: 0, low: 0 });
  for (const issue of issues) {
    const day = new Date(issue.createdAt).toISOString().slice(0, 10);
    const entry = grouped.get(day);
    if (!entry) continue;
    if (issue.priority in entry) entry[issue.priority]++;
  }

  const maxValue = Math.max(...Array.from(grouped.values()).map(v => Object.values(v).reduce((a, b) => a + b, 0)), 1);
  const hasData = Array.from(grouped.values()).some(v => Object.values(v).reduce((a, b) => a + b, 0) > 0);

  if (!hasData) return <p className="text-xs text-muted-foreground">No issues</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map(day => {
          const entry = grouped.get(day)!;
          const total = Object.values(entry).reduce((a, b) => a + b, 0);
          const heightPct = (total / maxValue) * 100;
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex flex-col justify-end">
                  {total > 0 ? (
                    <div className="flex flex-col-reverse gap-px overflow-hidden" style={{ height: `${heightPct}%`, minHeight: 2 }}>
                      {priorityOrder.map(p => entry[p] > 0 ? (
                        <div key={p} style={{ flex: entry[p], backgroundColor: priorityColors[p] }} />
                      ) : null)}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day}: {total} issues
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <DateLabels days={days} />
      <ChartLegend items={priorityOrder.map(p => ({ color: priorityColors[p], label: p.charAt(0).toUpperCase() + p.slice(1) }))} />
    </div>
  );
}

const statusColors: Record<string, string> = {
  todo: "#3b82f6",
  in_progress: "#8b5cf6",
  in_review: "#a855f7",
  done: "#10b981",
  blocked: "#ef4444",
  cancelled: "#6b7280",
  backlog: "#64748b",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
  backlog: "Backlog",
};

export function IssueStatusChart({ issues }: { issues: { status: string; createdAt: Date }[] }) {
  const days = getLast14Days();
  const allStatuses = new Set<string>();
  const grouped = new Map<string, Record<string, number>>();
  for (const day of days) grouped.set(day, {});
  for (const issue of issues) {
    const day = new Date(issue.createdAt).toISOString().slice(0, 10);
    const entry = grouped.get(day);
    if (!entry) continue;
    entry[issue.status] = (entry[issue.status] ?? 0) + 1;
    allStatuses.add(issue.status);
  }

  const statusOrder = ["todo", "in_progress", "in_review", "done", "blocked", "cancelled", "backlog"].filter(s => allStatuses.has(s));
  const maxValue = Math.max(...Array.from(grouped.values()).map(v => Object.values(v).reduce((a, b) => a + b, 0)), 1);
  const hasData = allStatuses.size > 0;

  if (!hasData) return <p className="text-xs text-muted-foreground">No issues</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map(day => {
          const entry = grouped.get(day)!;
          const total = Object.values(entry).reduce((a, b) => a + b, 0);
          const heightPct = (total / maxValue) * 100;
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex flex-col justify-end">
                  {total > 0 ? (
                    <div className="flex flex-col-reverse gap-px overflow-hidden" style={{ height: `${heightPct}%`, minHeight: 2 }}>
                      {statusOrder.map(s => (entry[s] ?? 0) > 0 ? (
                        <div key={s} style={{ flex: entry[s], backgroundColor: statusColors[s] ?? "#6b7280" }} />
                      ) : null)}
                    </div>
                  ) : (
                    <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day}: {total} issues
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <DateLabels days={days} />
      <ChartLegend items={statusOrder.map(s => ({ color: statusColors[s] ?? "#6b7280", label: statusLabels[s] ?? s }))} />
    </div>
  );
}

export function SuccessRateChart({ runs }: { runs: HeartbeatRun[] }) {
  const days = getLast14Days();
  const grouped = new Map<string, { succeeded: number; total: number }>();
  for (const day of days) grouped.set(day, { succeeded: 0, total: 0 });
  for (const run of runs) {
    const day = new Date(run.createdAt).toISOString().slice(0, 10);
    const entry = grouped.get(day);
    if (!entry) continue;
    entry.total++;
    if (run.status === "succeeded") entry.succeeded++;
  }

  const hasData = Array.from(grouped.values()).some(v => v.total > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No runs yet</p>;

  return (
    <div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map(day => {
          const entry = grouped.get(day)!;
          const rate = entry.total > 0 ? entry.succeeded / entry.total : 0;
          const color = entry.total === 0 ? undefined : rate >= 0.8 ? "#10b981" : rate >= 0.5 ? "#eab308" : "#ef4444";
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex flex-col justify-end">
                  {entry.total > 0 ? (
                    <div style={{ height: `${rate * 100}%`, minHeight: 2, backgroundColor: color }} />
                  ) : (
                    <div className="bg-muted/30 rounded-sm" style={{ height: 2 }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day}: {entry.total > 0 ? Math.round(rate * 100) : 0}% ({entry.succeeded}/{entry.total})
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <DateLabels days={days} />
    </div>
  );
}

// Colour palette for per-agent token bars (cycles if > 8 agents)
const AGENT_COLORS = [
  "#6366f1", "#10b981", "#f97316", "#3b82f6",
  "#a855f7", "#ec4899", "#eab308", "#14b8a6",
];

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function TokenUsageChart({ data }: { data: TokenUsageSummary }) {
  const { byAgent, totalInputTokens, totalOutputTokens } = data;
  if (byAgent.length === 0) return <p className="text-xs text-muted-foreground">No token usage yet</p>;

  const maxTokens = Math.max(...byAgent.map((r) => r.totalTokens), 1);

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-muted-foreground">
        {formatTokens(totalInputTokens + totalOutputTokens)} total &middot; {formatTokens(totalInputTokens)} in / {formatTokens(totalOutputTokens)} out
      </p>
      {byAgent.slice(0, 8).map((row, i) => (
        <div key={row.agentId} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground truncate w-20 shrink-0">{row.agentName}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm"
              style={{
                width: `${(row.totalTokens / maxTokens) * 100}%`,
                backgroundColor: AGENT_COLORS[i % AGENT_COLORS.length],
              }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right shrink-0">
            {formatTokens(row.totalTokens)}
          </span>
        </div>
      ))}
    </div>
  );
}

function getLast30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

export function BurndownChart({ data }: { data: BurndownSummary }) {  const days = getLast30Days();
  const daySet = new Set(days);

  const openedMap = new Map(data.data.map((d) => [d.date, d.opened]));
  const closedMap = new Map(data.data.map((d) => [d.date, d.closed]));

  const maxValue = Math.max(
    ...days.map((d) => Math.max(openedMap.get(d) ?? 0, closedMap.get(d) ?? 0)),
    1,
  );

  const hasData = data.data.some((d) => daySet.has(d.date) && (d.opened > 0 || d.closed > 0));
  if (!hasData) return <p className="text-xs text-muted-foreground">No issue activity yet</p>;

  return (
    <div>
      <div className="flex items-end gap-[2px] h-20">
        {days.map((day) => {
          const opened = openedMap.get(day) ?? 0;
          const closed = closedMap.get(day) ?? 0;
          const openedPct = (opened / maxValue) * 100;
          const closedPct = (closed / maxValue) * 100;
          return (
            <Tooltip key={day}>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex flex-col-reverse justify-start gap-px">
                  {opened > 0 ? (
                    <div className="w-full bg-blue-400 rounded-sm" style={{ height: `${openedPct}%`, minHeight: 2 }} />
                  ) : (
                    <div className="w-full bg-muted/20 rounded-sm" style={{ height: 2 }} />
                  )}
                  {closed > 0 ? (
                    <div className="w-full bg-emerald-500 rounded-sm" style={{ height: `${closedPct}%`, minHeight: 2 }} />
                  ) : (
                    <div className="w-full bg-muted/20 rounded-sm" style={{ height: 2 }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day}: +{opened} opened, {closed} closed
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1.5">
        {days.map((day, i) => (
          <div key={day} className="flex-1 text-center">
            {(i === 0 || i === 14 || i === 29) ? (
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {(() => { const d = new Date(day + "T12:00:00"); return `${d.getMonth() + 1}/${d.getDate()}`; })()}
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <ChartLegend items={[{ color: "#3b82f6", label: "Opened" }, { color: "#10b981", label: "Closed" }]} />
    </div>
  );
}

export function TasksByAgentChart({ data }: { data: TasksByAgentSummary }) {
  const { byAgent } = data;
  if (byAgent.length === 0) return <p className="text-xs text-muted-foreground">No tasks assigned yet</p>;

  const maxTotal = Math.max(...byAgent.map((r) => r.totalCount), 1);

  return (
    <div className="space-y-1.5">
      {byAgent.slice(0, 8).map((row) => (
        <div key={row.agentId} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground truncate w-20 shrink-0">{row.agentName}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden flex">
            {row.inProgressCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: `${(row.inProgressCount / maxTotal) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">In progress: {row.inProgressCount}</TooltipContent>
              </Tooltip>
            )}
            {(row.openCount - row.inProgressCount) > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-blue-400"
                    style={{ width: `${((row.openCount - row.inProgressCount) / maxTotal) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Open: {row.openCount - row.inProgressCount}</TooltipContent>
              </Tooltip>
            )}
            {row.doneCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(row.doneCount / maxTotal) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Done: {row.doneCount}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right shrink-0">
            {row.totalCount}
          </span>
        </div>
      ))}
      <ChartLegend items={[
        { color: "#8b5cf6", label: "In Progress" },
        { color: "#60a5fa", label: "Open" },
        { color: "#10b981", label: "Done" },
      ]} />
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function AgentTimeChart({ data }: { data: AgentTimeSummary }) {
  const { byAgent } = data;
  if (byAgent.length === 0) return <p className="text-xs text-muted-foreground">No run data yet</p>;

  const maxSeconds = Math.max(...byAgent.map((r) => r.totalSeconds), 1);

  return (
    <div className="space-y-1.5">
      {byAgent.slice(0, 8).map((row, i) => (
        <div key={row.agentId} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground truncate w-20 shrink-0">{row.agentName}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden">
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className="h-full rounded-sm"
                  style={{
                    width: `${(row.totalSeconds / maxSeconds) * 100}%`,
                    backgroundColor: AGENT_COLORS[i % AGENT_COLORS.length],
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {row.runCount} run{row.runCount === 1 ? "" : "s"} · avg {formatDuration(row.avgSeconds)}
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right shrink-0">
            {formatDuration(row.totalSeconds)}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground/60 mt-1">
        Total wall-clock time for completed runs
      </p>
    </div>
  );
}

/* ---- New Chart Components ---- */

export function IssuesByProjectChart({ data }: { data: IssuesByProjectSummary }) {
  const { byProject } = data;
  if (byProject.length === 0) return <p className="text-xs text-muted-foreground">No project data yet</p>;

  const maxTotal = Math.max(...byProject.map((r) => r.totalCount), 1);

  return (
    <div className="space-y-1.5">
      {byProject.slice(0, 8).map((row, i) => (
        <div key={row.projectId} className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground truncate w-24 shrink-0">{row.projectName}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded-sm overflow-hidden flex">
            {row.inProgressCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-full bg-violet-500" style={{ width: `${(row.inProgressCount / maxTotal) * 100}%` }} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">In progress: {row.inProgressCount}</TooltipContent>
              </Tooltip>
            )}
            {(row.openCount - row.inProgressCount) > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-full bg-blue-400" style={{ width: `${((row.openCount - row.inProgressCount) / maxTotal) * 100}%` }} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Open: {row.openCount - row.inProgressCount}</TooltipContent>
              </Tooltip>
            )}
            {row.doneCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="h-full bg-emerald-500" style={{ width: `${(row.doneCount / maxTotal) * 100}%` }} />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Done: {row.doneCount}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right shrink-0">{row.totalCount}</span>
        </div>
      ))}
      <ChartLegend items={[
        { color: "#8b5cf6", label: "In Progress" },
        { color: "#60a5fa", label: "Open" },
        { color: "#10b981", label: "Done" },
      ]} />
    </div>
  );
}

function formatCycleTime(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function CycleTimeWidget({ data }: { data: CycleTimeSummary }) {
  if (data.totalClosed === 0) return <p className="text-xs text-muted-foreground">No closed issues yet</p>;

  const avg = data.avgCycleSeconds;
  const median = data.medianCycleSeconds;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Cycle Time</p>
          <p className="text-xl font-semibold tabular-nums mt-0.5">
            {avg !== null ? formatCycleTime(avg) : "—"}
          </p>
        </div>
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Median</p>
          <p className="text-xl font-semibold tabular-nums mt-0.5">
            {median !== null ? formatCycleTime(median) : "—"}
          </p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Based on {data.totalClosed} issue{data.totalClosed === 1 ? "" : "s"} closed in last {data.days} days
      </p>
    </div>
  );
}

function formatCents(cents: number): string {
  if (cents === 0) return "$0";
  if (cents < 100) return `$${(cents / 100).toFixed(2)}`;
  return `$${(cents / 100).toFixed(0)}`;
}

export function CostTrendChart({ data }: { data: CostTrendSummary }) {
  const { data: days, totalCostCents } = data;
  const hasData = days.some((d) => d.costCents > 0);
  if (!hasData) return <p className="text-xs text-muted-foreground">No cost data yet</p>;

  const maxCents = Math.max(...days.map((d) => d.costCents), 1);

  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-2">
        Total: {formatCents(totalCostCents)}
      </p>
      <div className="flex items-end gap-[2px] h-20">
        {days.map((day, i) => {
          const heightPct = (day.costCents / maxCents) * 100;
          return (
            <Tooltip key={day.date}>
              <TooltipTrigger asChild>
                <div className="flex-1 h-full flex flex-col justify-end">
                  {day.costCents > 0 ? (
                    <div className="bg-amber-500 rounded-sm" style={{ height: `${heightPct}%`, minHeight: 2 }} />
                  ) : (
                    <div className="bg-muted/20 rounded-sm" style={{ height: 2 }} />
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {day.date}: {formatCents(day.costCents)}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
      <div className="flex gap-[2px] mt-1.5">
        {days.map((day, i) => (
          <div key={day.date} className="flex-1 text-center">
            {(i === 0 || i === Math.floor(days.length / 2) || i === days.length - 1) ? (
              <span className="text-[9px] text-muted-foreground tabular-nums">
                {(() => { const d = new Date(day.date + "T12:00:00"); return `${d.getMonth() + 1}/${d.getDate()}`; })()}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AgentStatusChart({ agents }: { agents: { status: string }[] }) {
  if (agents.length === 0) return <p className="text-xs text-muted-foreground">No agents</p>;

  const counts: Record<string, number> = { idle: 0, running: 0, paused: 0, error: 0, offline: 0 };
  for (const a of agents) {
    const key = a.status in counts ? a.status : "offline";
    counts[key]++;
  }

  const entries = [
    { key: "running", label: "Running", color: "#10b981" },
    { key: "idle",    label: "Idle",    color: "#6366f1" },
    { key: "paused",  label: "Paused",  color: "#f97316" },
    { key: "error",   label: "Error",   color: "#ef4444" },
    { key: "offline", label: "Offline", color: "#6b7280" },
  ].filter((e) => counts[e.key] > 0);

  const total = agents.length;
  const radius = 36;
  const cx = 48;
  const cy = 48;
  const circumference = 2 * Math.PI * radius;

  let cumPct = 0;
  const slices = entries.map((e) => {
    const pct = counts[e.key] / total;
    const slice = { ...e, pct, offset: cumPct };
    cumPct += pct;
    return slice;
  });

  return (
    <div className="flex items-center gap-4">
      <svg width={96} height={96} viewBox="0 0 96 96" className="shrink-0 -rotate-90">
        {slices.map((s) => (
          <circle
            key={s.key}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={18}
            strokeDasharray={`${s.pct * circumference} ${circumference}`}
            strokeDashoffset={`${-s.offset * circumference}`}
          />
        ))}
      </svg>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.key} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
            <span className="text-[11px] text-muted-foreground">{e.label}</span>
            <span className="text-[11px] font-medium ml-auto pl-2 tabular-nums">{counts[e.key]}</span>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground/60 pt-0.5">{total} total</p>
      </div>
    </div>
  );
}

export function BlockedIssuesWidget({ issues }: { issues: { id: string; identifier?: string | null; title: string; assigneeAgentId?: string | null; status: string }[] }) {
  const blocked = issues.filter((i) => i.status === "blocked");
  if (blocked.length === 0) return <p className="text-xs text-muted-foreground">No blocked issues</p>;

  return (
    <div className="space-y-1">
      <p className="text-[10px] text-muted-foreground mb-2">{blocked.length} blocked issue{blocked.length === 1 ? "" : "s"}</p>
      {blocked.slice(0, 8).map((issue) => (
        <Link
          key={issue.id}
          to={`/issues/${issue.identifier ?? issue.id}`}
          className="flex items-center gap-2 px-2 py-1.5 rounded bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors no-underline text-inherit"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{issue.identifier ?? issue.id.slice(0, 6)}</span>
          <span className="text-[11px] truncate flex-1">{issue.title}</span>
        </Link>
      ))}
      {blocked.length > 8 && (
        <p className="text-[10px] text-muted-foreground/60">+{blocked.length - 8} more</p>
      )}
    </div>
  );
}

export function ProjectHealthWidget({ data }: { data: ProjectHealthSummary }) {
  const { projects } = data;
  if (projects.length === 0) return <p className="text-xs text-muted-foreground">No projects yet</p>;

  return (
    <div className="space-y-1.5">
      {projects.slice(0, 8).map((row) => (
        <div key={row.projectId} className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground truncate flex-1 min-w-0">{row.projectName}</span>
            <div className="flex items-center gap-1 shrink-0">
              {row.isOverdue && (
                <span className="text-[9px] font-medium px-1 rounded bg-red-500/15 text-red-500 border border-red-500/20">
                  overdue
                </span>
              )}
              {row.blockedIssueCount > 0 && (
                <span className="text-[9px] font-medium px-1 rounded bg-orange-500/15 text-orange-500 border border-orange-500/20">
                  {row.blockedIssueCount} blocked
                </span>
              )}
              <span className="text-[10px] tabular-nums text-muted-foreground w-8 text-right">
                {row.completionPercent}%
              </span>
            </div>
          </div>
          <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden flex">
            {row.doneIssueCount > 0 && row.totalIssueCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${(row.doneIssueCount / row.totalIssueCount) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Done: {row.doneIssueCount}</TooltipContent>
              </Tooltip>
            )}
            {row.inProgressIssueCount > 0 && row.totalIssueCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-violet-500"
                    style={{ width: `${(row.inProgressIssueCount / row.totalIssueCount) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">In Progress: {row.inProgressIssueCount}</TooltipContent>
              </Tooltip>
            )}
            {row.blockedIssueCount > 0 && row.totalIssueCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="h-full bg-red-500"
                    style={{ width: `${(row.blockedIssueCount / row.totalIssueCount) * 100}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Blocked: {row.blockedIssueCount}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      ))}
      {projects.length > 8 && (
        <p className="text-[10px] text-muted-foreground/60">+{projects.length - 8} more projects</p>
      )}
      <ChartLegend items={[
        { color: "#10b981", label: "Done" },
        { color: "#8b5cf6", label: "In Progress" },
        { color: "#ef4444", label: "Blocked" },
      ]} />
    </div>
  );
}

// ── Sprint Overview Widget ────────────────────────────────────────────────────

const SPRINT_STATUS_STYLES: Record<string, string> = {
  active: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20",
  planning: "text-blue-600 bg-blue-500/10 border-blue-500/20",
  completed: "text-muted-foreground bg-muted/40 border-border",
  cancelled: "text-red-500 bg-red-500/10 border-red-500/20",
};

function fmt(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function SprintRow({ sprint }: { sprint: Sprint }) {
  const statusStyle = SPRINT_STATUS_STYLES[sprint.status] ?? "text-muted-foreground";
  const start = fmt(sprint.startDate);
  const end = fmt(sprint.endDate);

  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate">{sprint.name}</span>
        <span
          className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusStyle}`}
        >
          {sprint.status}
        </span>
      </div>
      {sprint.goal && (
        <p className="text-[11px] text-muted-foreground truncate">{sprint.goal}</p>
      )}
      {(start ?? end) && (
        <p className="text-[10px] text-muted-foreground/60">
          {[start, end].filter(Boolean).join(" → ")}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// World Clock Widget
// ---------------------------------------------------------------------------

/** Ticks every 30 seconds (minute precision is sufficient for the widget). */
function useWidgetTick() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function WorldClockWidget() {
  const now = useWidgetTick();
  const { timezones, addTimezone, removeTimezone, moveTimezone } = useTimezones();

  const [search, setSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handler(e: MouseEvent) {
      if (
        !dropdownRef.current?.contains(e.target as Node) &&
        !buttonRef.current?.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const results: SearchResult[] = searchTimezones(search, 40);
  const addedTzSet = new Set(timezones.map((t) => t.tz));

  if (timezones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
        <Globe className="h-8 w-8 text-muted-foreground/40" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">No Time Zones added</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Search for a city to start tracking world times.
          </p>
        </div>
        <WorldClockSearch
          search={search}
          setSearch={setSearch}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          dropdownRef={dropdownRef}
          buttonRef={buttonRef}
          results={results}
          addedTzSet={addedTzSet}
          onAdd={(tz, label) => { addTimezone(tz, label); setSearch(""); setDropdownOpen(false); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Clock rows */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))" }}>
        {timezones.map((entry, idx) => {
          const { time, ampm, day, offset } = formatTzDateTime(entry.tz, now);
          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <div
                  className="group relative flex flex-col gap-0.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2 hover:bg-muted/60 transition-colors"
                >
                  {/* Remove button */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => removeTimezone(entry.id)}
                        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">Remove</TooltipContent>
                  </Tooltip>
                  {/* Reorder buttons */}
                  <div className="absolute bottom-1.5 right-1.5 flex-col gap-px opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => moveTimezone(entry.id, "up")}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default leading-none"
                        >
                          <ChevronUp className="h-2.5 w-2.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Move left</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => moveTimezone(entry.id, "down")}
                          disabled={idx === timezones.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-default leading-none"
                        >
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">Move right</TooltipContent>
                    </Tooltip>
                  </div>
              <span className="text-[10px] font-medium text-muted-foreground truncate pr-4">{entry.label}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-lg font-mono font-semibold tabular-nums leading-tight">{time}</span>
                {ampm && <span className="text-[10px] font-medium text-muted-foreground">{ampm}</span>}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                <span>{day}</span>
                {offset && <><span className="text-border/60">·</span><span>{offset}</span></>}
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">{entry.tz}</TooltipContent>
        </Tooltip>
          );
        })}
      </div>

      {/* Add more */}
      <div className="flex justify-end pt-1">
        <WorldClockSearch
          search={search}
          setSearch={setSearch}
          dropdownOpen={dropdownOpen}
          setDropdownOpen={setDropdownOpen}
          dropdownRef={dropdownRef}
          buttonRef={buttonRef}
          results={results}
          addedTzSet={addedTzSet}
          onAdd={(tz, label) => { addTimezone(tz, label); setSearch(""); setDropdownOpen(false); }}
        />
      </div>
    </div>
  );
}

interface WorldClockSearchProps {
  search: string;
  setSearch: (v: string) => void;
  dropdownOpen: boolean;
  setDropdownOpen: (v: boolean) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  results: SearchResult[];
  addedTzSet: Set<string>;
  onAdd: (tz: string, label: string) => void;
}

function WorldClockSearch({
  search,
  setSearch,
  dropdownOpen,
  setDropdownOpen,
  dropdownRef,
  buttonRef,
  results,
  addedTzSet,
  onAdd,
}: WorldClockSearchProps) {
  return (
    <div className="relative">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded px-2 py-1 hover:bg-muted/60 border border-border/50"
          >
            <Globe className="h-3.5 w-3.5" />
            <Plus className="h-3 w-3" />
            <span>Add city</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">Add Time Zone</TooltipContent>
      </Tooltip>

      {dropdownOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-0 bottom-full mb-1 z-50 w-72 rounded-lg border border-border bg-popover shadow-lg text-sm"
        >
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold mb-2">Add Time Zone</p>
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search city (NYC, Tokyo, Dubai…)"
              className="w-full rounded border border-border bg-background px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {search.trim() === "" ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                Start typing a city name
              </p>
            ) : results.length === 0 ? (
              <p className="px-3 py-4 text-xs text-muted-foreground text-center">No results</p>
            ) : (
              results.map((r) => {
                const isAdded = addedTzSet.has(r.tz);
                return (
                  <button
                    key={`${r.label}|${r.tz}`}
                    disabled={isAdded}
                    onClick={() => onAdd(r.tz, r.label)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 disabled:opacity-40 disabled:cursor-default transition-colors text-left"
                  >
                    {r.flag && <span className="text-sm shrink-0">{r.flag}</span>}
                    <span className="flex-1 truncate">
                      <span className="font-medium">{r.label}</span>
                      {r.country && (
                        <span className="text-muted-foreground ml-1">{r.country}</span>
                      )}
                    </span>
                    {isAdded && <span className="text-[10px] text-muted-foreground shrink-0">added</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sprint Overview Widget
// ---------------------------------------------------------------------------

export function SprintOverviewWidget({ sprints }: { sprints: Sprint[] }) {
  const active = sprints.filter((s) => s.status === "active");
  const planning = sprints.filter((s) => s.status === "planning");
  const featured = [...active, ...planning].slice(0, 4);

  if (sprints.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">
        No sprints found. Create your first sprint to track progress here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {/* Summary row */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          <span className="font-semibold text-emerald-600">{active.length}</span> active
        </span>
        <span>
          <span className="font-semibold text-blue-600">{planning.length}</span> planning
        </span>
        {sprints.length - active.length - planning.length > 0 && (
          <span className="text-muted-foreground/50">
            +{sprints.length - active.length - planning.length} other
          </span>
        )}
      </div>

      {/* Sprint rows */}
      <div className="space-y-1.5">
        {featured.map((s) => (
          <SprintRow key={s.id} sprint={s} />
        ))}
      </div>

      {sprints.length > 4 && (
        <p className="text-[10px] text-muted-foreground/60">
          +{sprints.length - 4} more sprints
        </p>
      )}
    </div>
  );
}
