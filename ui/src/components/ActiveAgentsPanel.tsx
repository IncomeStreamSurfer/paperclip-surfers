import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { heartbeatsApi, type LiveRunForIssue } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { departmentsApi, type DepartmentWithAgents } from "../api/departments";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime, formatTokens } from "../lib/utils";
import { AgentIcon } from "./AgentIconPicker";
import { useLiveRunTranscripts } from "./transcript/useLiveRunTranscripts";
import { RunTranscriptView } from "./transcript/RunTranscriptView";
import { SpeechBubble } from "./SpeechBubble";
import { getSayHelloResponse, getReportInResponse } from "../lib/agent-responses";
import { useToast } from "../context/ToastContext";
import { ChevronDown, ChevronUp, CircleDot, Cpu, DollarSign, Wrench, Activity, MessageCircle, FileText, Loader2 } from "lucide-react";
import { Tooltip } from "./Tooltip";
import type { TranscriptEntry } from "../adapters";

const MIN_DASHBOARD_RUNS = 8;

export function latestActivityPreview(entries: TranscriptEntry[]): string | null {
  if (entries.length === 0) return null;
  for (let i = entries.length - 1; i >= Math.max(0, entries.length - 5); i--) {
    const entry = entries[i];
    switch (entry.kind) {
      case "tool_call":
        return `Using ${entry.name}`;
      case "thinking":
        return "Thinking…";
      case "assistant":
        if (entry.delta) return "Responding…";
        break;
      case "result":
        return entry.isError ? "Run failed" : "Completed";
      case "init":
        return "Starting…";
    }
  }
  const last = entries[entries.length - 1];
  switch (last.kind) {
    case "assistant":
      return "Responded";
    case "stdout":
    case "stderr":
      return "Output…";
    case "system":
      return "System event…";
    case "tool_result":
      return last.isError ? "Tool errored" : "Tool result";
    default:
      return null;
  }
}

interface ActiveAgentsPanelProps {
  companyId: string;
  agents: Agent[];
}

function statusDotClass(status: string, isLive: boolean): string {
  if (isLive) return "bg-cyan-400 ring-1 ring-cyan-300/60";
  switch (status) {
    case "idle":    return "bg-emerald-400";
    case "running": return "bg-cyan-400";
    case "paused":  return "bg-amber-400";
    case "error":   return "bg-red-500";
    case "terminated": return "bg-muted-foreground/40";
    default:        return "bg-muted-foreground/40";
  }
}

function statusLabel(agent: Agent, run: LiveRunForIssue | undefined, issue: Issue | undefined): string {
  if (run) {
    const live = run.status === "running" || run.status === "queued";
    if (live) {
      return issue?.title
        ? issue.title
        : run.issueId
        ? `Task ${run.issueId.slice(0, 8)}`
        : "Running…";
    }
    if (issue?.title) return issue.title;
    return run.finishedAt ? `Done ${relativeTime(run.finishedAt)}` : "Recent run";
  }
  switch (agent.status) {
    case "idle":    return "Idle · available";
    case "paused":  return "Paused";
    case "error":   return "Error";
    case "pending_approval": return "Pending approval";
    case "terminated": return "Terminated";
    default:        return agent.status;
  }
}

function runMetrics(run: LiveRunForIssue) {
  const metrics = (run as unknown as Record<string, unknown>).metrics as
    | { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number; costCents?: number }
    | undefined;
  const input = metrics?.inputTokens ?? 0;
  const output = metrics?.outputTokens ?? 0;
  const cached = metrics?.cachedInputTokens ?? 0;
  const total = input + output + cached;
  const costCents = metrics?.costCents ?? 0;
  return { input, output, cached, total, costCents };
}

// ---------------------------------------------------------------------------
// useBubbles — per-agent speech bubble state with thinking animation
// Shows "thinking" spinner for 1-3s, then reveals the response
// ---------------------------------------------------------------------------

function randBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type BubbleState = { text: string; thinking: boolean };

function useBubbles(visibleMs = 10000) {
  const [bubbles, setBubbles] = useState<Map<string, BubbleState>>(new Map());
  const timers = useRef<Map<string, { thinkingTimer: ReturnType<typeof setTimeout>; clearTimer: ReturnType<typeof setTimeout> }>>(new Map());

  const showBubble = useCallback((agentId: string, text: string) => {
    const existing = timers.current.get(agentId);
    if (existing) {
      clearTimeout(existing.thinkingTimer);
      clearTimeout(existing.clearTimer);
    }

    const thinkingMs = randBetween(1000, 3000);
    const totalMs = thinkingMs + visibleMs;

    setBubbles((prev) => new Map(prev).set(agentId, { text, thinking: true }));

    const thinkingTimer = setTimeout(() => {
      setBubbles((prev) => {
        const current = prev.get(agentId);
        if (!current) return prev;
        const next = new Map(prev);
        next.set(agentId, { ...current, thinking: false });
        return next;
      });
    }, thinkingMs);

    const clearTimer = setTimeout(() => {
      setBubbles((prev) => {
        const next = new Map(prev);
        next.delete(agentId);
        return next;
      });
      timers.current.delete(agentId);
    }, totalMs);

    timers.current.set(agentId, { thinkingTimer, clearTimer });
  }, [visibleMs]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const { thinkingTimer, clearTimer } of t.values()) {
        clearTimeout(thinkingTimer);
        clearTimeout(clearTimer);
      }
    };
  }, []);

  return { bubbles, showBubble };
}

export function ActiveAgentsPanel({ companyId, agents }: ActiveAgentsPanelProps) {
  const { pushToast } = useToast();
  const { bubbles, showBubble } = useBubbles();

  const { data: liveRuns } = useQuery({
    queryKey: [...queryKeys.liveRuns(companyId), "dashboard"],
    queryFn: () => heartbeatsApi.liveRunsForCompany(companyId, MIN_DASHBOARD_RUNS),
  });

  const runs = liveRuns ?? [];

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () => issuesApi.list(companyId),
    enabled: runs.length > 0,
  });

  const { data: deptsData } = useQuery({
    queryKey: [...queryKeys.departments.list(companyId), "withAgents"],
    queryFn: () => departmentsApi.list(companyId, true),
  });

  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues ?? []) map.set(issue.id, issue);
    return map;
  }, [issues]);

  const agentDeptMap = useMemo(() => {
    const map = new Map<string, string>();
    const depts = (deptsData?.departments ?? []) as DepartmentWithAgents[];
    for (const dept of depts) {
      for (const a of dept.agents ?? []) {
        if (!map.has(a.agentId)) map.set(a.agentId, dept.name);
      }
    }
    return map;
  }, [deptsData]);

  const runByAgent = useMemo(() => {
    const map = new Map<string, LiveRunForIssue>();
    for (const run of runs) {
      if (!map.has(run.agentId)) map.set(run.agentId, run);
    }
    return map;
  }, [runs]);

  const { transcriptByRun, hasOutputForRun } = useLiveRunTranscripts({ runs, companyId });

  const sayHelloMutation = useMutation({
    mutationFn: async () => {
      const active = agents.filter(
        (a) => a.status !== "terminated" && a.status !== "paused" && a.status !== "pending_approval",
      );
      const results = await Promise.allSettled(
        active.map((a) => fetch(`/api/agents/${a.id}/heartbeat/invoke`, { method: "POST" })),
      );
      const succeeded = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
      return { succeeded, total: results.length, active };
    },
    onSuccess: ({ succeeded, total, active }) => {
      active.forEach((agent, i) => {
        setTimeout(() => {
          const run = runByAgent.get(agent.id);
          showBubble(agent.id, getSayHelloResponse({
            name: agent.id,
            role: agent.role,
            title: agent.title,
            status: run ? "running" : agent.status,
            dept: agentDeptMap.get(agent.id),
          }));
        }, i * 120);
      });
    },
    onError: () => pushToast({ title: "Failed to say hello", tone: "error" }),
  });

  function triggerReportIn() {
    for (const agent of agents) {
      if (agent.status === "terminated") continue;
      const run = runByAgent.get(agent.id);
      const issue = run?.issueId ? issueById.get(run.issueId) : undefined;
      showBubble(agent.id, getReportInResponse({
        name: agent.id,
        role: agent.role,
        title: agent.title,
        status: run ? (run.status === "running" || run.status === "queued" ? "running" : agent.status) : agent.status,
        issueTitle: issue?.title,
        dept: agentDeptMap.get(agent.id),
      }));
    }
  }

  if (agents.length === 0) return null;

  const sorted = [...agents].sort((a, b) => {
    const order = (ag: Agent) => {
      const run = runByAgent.get(ag.id);
      if (run && (run.status === "running" || run.status === "queued")) return 0;
      if (ag.status === "idle") return 1;
      if (ag.status === "active") return 2;
      if (ag.status === "paused") return 3;
      return 4;
    };
    return order(a) - order(b);
  });

  useEffect(() => {
    if (expandedAgentId !== null) return;
    const firstLive = sorted.find((ag) => {
      const run = runByAgent.get(ag.id);
      return run && (run.status === "running" || run.status === "queued");
    });
    if (firstLive) setExpandedAgentId(firstLive.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents.length, runs.length]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Agents
          <span className="ml-2 text-xs font-normal normal-case text-muted-foreground/60">
            {agents.length} total
          </span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => triggerReportIn()}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Report in"
          >
            <FileText className="h-3 w-3" />
            Report in
          </button>
          <button
            type="button"
            onClick={() => sayHelloMutation.mutate()}
            disabled={sayHelloMutation.isPending}
            className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors disabled:opacity-50"
            title="Say hello to all agents"
          >
            {sayHelloMutation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MessageCircle className="h-3 w-3" />
            )}
            Say hello
          </button>
          <Link
            to="/agents"
            className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors no-underline font-medium"
          >
            View all →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {sorted.map((agent) => {
          const run = runByAgent.get(agent.id);
          const issue = run?.issueId ? issueById.get(run.issueId) : undefined;
          const isLive = !!run && (run.status === "running" || run.status === "queued");
          const href = run
            ? `/agents/${agent.id}/runs/${run.id}`
            : `/agents/${agent.id}`;
          const isExpanded = expandedAgentId === agent.id;
          const transcript = run ? transcriptByRun.get(run.id) ?? [] : [];
          const metrics = run ? runMetrics(run) : null;
          const bubble = bubbles.get(agent.id);

          return (
            <div
              key={agent.id}
              className={cn(
                "relative rounded-lg border transition-colors",
                isLive
                  ? "border-cyan-500/30 bg-cyan-500/[0.04]"
                  : "border-border bg-background/60",
              )}
            >
              {bubble && <SpeechBubble text={bubble.text} thinking={bubble.thinking} />}

              <div className="flex items-center gap-2.5 px-3 py-2">
                <Link
                  to={href}
                  className="flex items-center gap-2.5 no-underline text-inherit flex-1 min-w-0"
                >
                  {/* Avatar / Icon with status dot */}
                  <div className="relative shrink-0">
                    <AgentIcon
                      icon={agent.icon}
                      avatarUrl={agent.avatarUrl}
                      className="h-8 w-8 rounded-full"
                    />
                    <span
                      className={cn(
                        "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                        statusDotClass(agent.status, isLive),
                        isLive && "animate-pulse",
                      )}
                    />
                  </div>

                  {/* Name + status */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <p className="truncate text-xs font-semibold leading-tight min-w-0">
                        {agent.name}
                      </p>
                      <span className={cn(
                        "shrink-0 text-[9px] font-medium px-1 py-px rounded leading-tight ml-1",
                        isLive
                          ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                          : agent.status === "paused"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted/60 text-muted-foreground",
                      )}>
                        {agent.status === "idle" && !run ? "Idle" : agent.status}
                      </span>
                      {agentDeptMap.get(agent.id) && (
                        <Tooltip content={agentDeptMap.get(agent.id)!}>
                          <span className="shrink-0 text-[9px] font-medium px-1 py-px rounded bg-muted/60 text-muted-foreground border border-border/60 leading-tight ml-1 max-w-[70px] truncate cursor-default">
                            {agentDeptMap.get(agent.id)}
                          </span>
                        </Tooltip>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                      {statusLabel(agent, run, issue)}
                    </p>
                    {!isExpanded && run && (
                      <p className="truncate text-[10px] leading-tight text-cyan-600 dark:text-cyan-400 flex items-center gap-1">
                        <Activity className={cn("h-2.5 w-2.5", isLive && "animate-pulse")} />
                        {latestActivityPreview(transcript) ?? (isLive ? "Working…" : "Recent run")}
                      </p>
                    )}
                  </div>
                </Link>

                {/* Expand toggle */}
                {run && (
                  <Tooltip content={isExpanded ? "Collapse stream" : "Expand live stream"}>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setExpandedAgentId(isExpanded ? null : agent.id);
                      }}
                      className="shrink-0 p-1 rounded hover:bg-accent/60 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </Tooltip>
                )}
              </div>

              {/* Expanded live stream */}
              {isExpanded && run && (
                <div className="border-t border-border/60 px-3 py-2 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                      <Cpu className="h-2.5 w-2.5" />
                      {agent.adapterType}
                    </span>
                    {metrics && metrics.total > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                        <Wrench className="h-2.5 w-2.5" />
                        {formatTokens(metrics.total)} tok
                      </span>
                    )}
                    {metrics && metrics.costCents > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border/60">
                        <DollarSign className="h-2.5 w-2.5" />
                        ${(metrics.costCents / 100).toFixed(2)}
                      </span>
                    )}
                    {issue && (
                      <Link
                        to={`/issues/${issue.identifier ?? issue.id}`}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors no-underline max-w-[200px]"
                      >
                        <CircleDot className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{issue.identifier ?? issue.title}</span>
                      </Link>
                    )}
                    <Link
                      to={`/agents/${agent.id}`}
                      className="ml-auto text-[10px] text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition-colors no-underline"
                    >
                      Skills, plugins & MCPs →
                    </Link>
                  </div>

                  <div className="max-h-[260px] overflow-y-auto">
                    <RunTranscriptView
                      entries={transcript}
                      density="compact"
                      limit={8}
                      streaming={isLive}
                      collapseStdout
                      emptyMessage={hasOutputForRun(run.id) ? "Waiting for transcript parsing..." : "Waiting for run output..."}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
