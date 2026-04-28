import { useMemo } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import type { Agent, Issue } from "@paperclipai/shared";
import { heartbeatsApi, type LiveRunForIssue } from "../api/heartbeats";
import { issuesApi } from "../api/issues";
import { departmentsApi, type DepartmentWithAgents } from "../api/departments";
import { queryKeys } from "../lib/queryKeys";
import { cn, relativeTime } from "../lib/utils";
import { AgentIcon } from "./AgentIconPicker";

const MIN_DASHBOARD_RUNS = 8;

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

export function ActiveAgentsPanel({ companyId, agents }: ActiveAgentsPanelProps) {
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

  const issueById = useMemo(() => {
    const map = new Map<string, Issue>();
    for (const issue of issues ?? []) map.set(issue.id, issue);
    return map;
  }, [issues]);

  // Build agentId → first department name map
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

  // Map agentId → most recent live run
  const runByAgent = useMemo(() => {
    const map = new Map<string, LiveRunForIssue>();
    // runs arrive newest-first; just take first occurrence per agent
    for (const run of runs) {
      if (!map.has(run.agentId)) map.set(run.agentId, run);
    }
    return map;
  }, [runs]);

  if (agents.length === 0) return null;

  // Sort: running/live first, then idle, then active, then others
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

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Agents
        <span className="ml-2 text-xs font-normal normal-case text-muted-foreground/60">
          {agents.length} total
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {sorted.map((agent) => {
          const run = runByAgent.get(agent.id);
          const issue = run?.issueId ? issueById.get(run.issueId) : undefined;
          const isLive = !!run && (run.status === "running" || run.status === "queued");
          const href = run
            ? `/agents/${agent.id}/runs/${run.id}`
            : `/agents/${agent.id}`;

          return (
            <Link
              key={agent.id}
              to={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-lg border px-3 py-2 no-underline text-inherit transition-colors",
                isLive
                  ? "border-cyan-500/30 bg-cyan-500/[0.04] hover:bg-cyan-500/[0.08]"
                  : "border-border bg-background/60 hover:bg-accent/40",
              )}
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
                  {agentDeptMap.get(agent.id) && (
                    <span className="shrink-0 text-[9px] font-medium px-1 py-px rounded bg-muted/60 text-muted-foreground border border-border/60 leading-tight ml-1 max-w-[70px] truncate">
                      {agentDeptMap.get(agent.id)}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">
                  {statusLabel(agent, run, issue)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
