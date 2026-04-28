import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Link, useNavigate, useLocation } from "@/lib/router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { agentsApi, type OrgNode } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { departmentsApi, type DepartmentWithAgents } from "../api/departments";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useSidebar } from "../context/SidebarContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { StatusBadge } from "../components/StatusBadge";
import { agentStatusDot, agentStatusDotDefault } from "../lib/status-colors";
import { EntityRow } from "../components/EntityRow";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { SpeechBubble } from "../components/SpeechBubble";
import { relativeTime, cn, agentRouteRef, agentUrl } from "../lib/utils";
import { PageTabBar } from "../components/PageTabBar";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bot, Plus, List, LayoutGrid, GitBranch, SlidersHorizontal, MessageCircle, Loader2, FileText, Clock, Pause, Play } from "lucide-react";
import { AGENT_ROLE_LABELS, type Agent } from "@paperclipai/shared";
import { AgentIcon } from "../components/AgentIconPicker";
import { getSayHelloResponse, getReportInResponse } from "../lib/agent-responses";

const adapterLabels: Record<string, string> = {
  claude_local: "Claude",
  codex_local: "Codex",
  gemini_local: "Gemini",
  opencode_local: "OpenCode",
  cursor: "Cursor",
  hermes_local: "Hermes",
  openclaw_gateway: "OpenClaw Gateway",
  process: "Process",
  http: "HTTP",
};

const roleLabels = AGENT_ROLE_LABELS as Record<string, string>;

type FilterTab = "all" | "active" | "paused" | "error";

function matchesFilter(status: string, tab: FilterTab, showTerminated: boolean): boolean {
  if (status === "terminated") return showTerminated;
  if (tab === "all") return true;
  if (tab === "active") return status === "active" || status === "running" || status === "idle";
  if (tab === "paused") return status === "paused";
  if (tab === "error") return status === "error";
  return true;
}

function filterAgents(agents: Agent[], tab: FilterTab, showTerminated: boolean): Agent[] {
  return agents
    .filter((a) => matchesFilter(a.status, tab, showTerminated))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function filterOrgTree(nodes: OrgNode[], tab: FilterTab, showTerminated: boolean): OrgNode[] {
  return nodes
    .reduce<OrgNode[]>((acc, node) => {
      const filteredReports = filterOrgTree(node.reports, tab, showTerminated);
      if (matchesFilter(node.status, tab, showTerminated) || filteredReports.length > 0) {
        acc.push({ ...node, reports: filteredReports });
      }
      return acc;
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// useBubbles — manages per-agent speech bubble state with auto-clear
// Shows a "thinking" spinner for 1-3s before revealing the response
// ---------------------------------------------------------------------------

function randBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

type BubbleState = { text: string; thinking: boolean };
type BubbleTimers = Map<string, { thinkingTimer: ReturnType<typeof setTimeout>; clearTimer: ReturnType<typeof setTimeout> }>;

function useBubbles(visibleMs = 10000) {
  const [bubbles, setBubbles] = useState<Map<string, BubbleState>>(new Map());
  const timers = useRef<BubbleTimers>(new Map());

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

export function Agents() {
  const { selectedCompanyId } = useCompany();
  const { openNewAgent } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useSidebar();
  const pathSegment = location.pathname.split("/").pop() ?? "all";
  const tab: FilterTab = (pathSegment === "all" || pathSegment === "active" || pathSegment === "paused" || pathSegment === "error") ? pathSegment : "all";
  const [view, setView] = useState<"list" | "grid" | "org">("org");
  const forceListView = isMobile;
  const effectiveView: "list" | "grid" | "org" = forceListView ? "list" : view;
  const [showTerminated, setShowTerminated] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { bubbles, showBubble } = useBubbles();

  const { data: agents, isLoading, error } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: orgTree } = useQuery({
    queryKey: queryKeys.org(selectedCompanyId!),
    queryFn: () => agentsApi.org(selectedCompanyId!),
    enabled: !!selectedCompanyId && effectiveView === "org",
  });

  const { data: deptsData } = useQuery({
    queryKey: [...queryKeys.departments.list(selectedCompanyId!), "agents"],
    queryFn: () => departmentsApi.list(selectedCompanyId!, true),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  // Map agentId -> first live run + live run count
  const liveRunByAgent = useMemo(() => {
    const map = new Map<string, { runId: string; liveCount: number }>();
    for (const r of runs ?? []) {
      if (r.status !== "running" && r.status !== "queued") continue;
      const existing = map.get(r.agentId);
      if (existing) {
        existing.liveCount += 1;
        continue;
      }
      map.set(r.agentId, { runId: r.id, liveCount: 1 });
    }
    return map;
  }, [runs]);

  // Map runId -> issue title (from runs that carry issueId)
  const issueTitleByAgent = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of runs ?? []) {
      if (r.status !== "running" && r.status !== "queued") continue;
      if ((r as unknown as Record<string, unknown>).issueTitle) {
        map.set(r.agentId, (r as unknown as Record<string, unknown>).issueTitle as string);
      }
    }
    return map;
  }, [runs]);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  // Build agentId -> department name map
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

  // Group filtered agents by department
  const agentsByDept = useMemo(() => {
    const map = new Map<string, Agent[]>();
    const ungrouped: Agent[] = [];
    for (const agent of filterAgents(agents ?? [], tab, showTerminated)) {
      const dept = agentDeptMap.get(agent.id);
      if (dept) {
        if (!map.has(dept)) map.set(dept, []);
        map.get(dept)!.push(agent);
      } else {
        ungrouped.push(agent);
      }
    }
    return { map, ungrouped };
  }, [agents, tab, showTerminated, agentDeptMap]);

  // ---------------------------------------------------------------------------
  // Say Hello to all agents — invoke heartbeat + generate bubbles
  // ---------------------------------------------------------------------------
  const sayHelloMutation = useMutation({
    mutationFn: async () => {
      const activeAgents = (agents ?? []).filter(
        (a) => a.status !== "terminated" && a.status !== "paused" && a.status !== "pending_approval"
      );
      const results = await Promise.allSettled(
        activeAgents.map((agent) =>
          fetch(`/api/agents/${agent.id}/heartbeat/invoke`, { method: "POST" })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled" && (r.value as Response).ok).length;
      const failed = results.length - succeeded;
      return { succeeded, failed, total: results.length, activeAgents };
    },
    onSuccess: ({ succeeded, failed, total, activeAgents }) => {
      activeAgents.forEach((agent, i) => {
        setTimeout(() => {
          const liveRun = liveRunByAgent.get(agent.id);
          const agentStatus = liveRun ? "running" : agent.status;
          showBubble(agent.id, getSayHelloResponse({
            name: agent.id,
            role: agent.role,
            title: agent.title,
            status: agentStatus,
            dept: agentDeptMap.get(agent.id),
          }));
        }, i * 120);
      });
    },
    onError: () => {
      pushToast({ title: "Failed to send hello to agents", tone: "error" });
    },
  });

  // ---------------------------------------------------------------------------
  // Recess — pause all non-terminated agents
  // ---------------------------------------------------------------------------
  const recessMutation = useMutation({
    mutationFn: async () => {
      const targets = (agents ?? []).filter((a) => a.status !== "terminated" && a.status !== "paused" && a.status !== "pending_approval");
      const results = await Promise.allSettled(
        targets.map((agent) => agentsApi.pause(agent.id, selectedCompanyId!))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      return { succeeded, total: targets.length };
    },
    onSuccess: ({ succeeded, total }) => {
      pushToast({ title: `Recessed ${succeeded}/${total} agents`, tone: "success" });
    },
    onError: () => pushToast({ title: "Recess failed", tone: "error" }),
  });

  // ---------------------------------------------------------------------------
  // Resume — resume all paused agents
  // ---------------------------------------------------------------------------
  const resumeAllMutation = useMutation({
    mutationFn: async () => {
      const targets = (agents ?? []).filter((a) => a.status === "paused");
      const results = await Promise.allSettled(
        targets.map((agent) => agentsApi.resume(agent.id, selectedCompanyId!))
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      return { succeeded, total: targets.length };
    },
    onSuccess: ({ succeeded, total }) => {
      pushToast({ title: `Resumed ${succeeded}/${total} agents`, tone: "success" });
    },
    onError: () => pushToast({ title: "Resume failed", tone: "error" }),
  });

  // ---------------------------------------------------------------------------
  // Report in — generate status bubbles for all visible agents
  // ---------------------------------------------------------------------------
  function triggerReportIn(targetAgents: Agent[]) {
    for (const agent of targetAgents) {
      const liveRun = liveRunByAgent.get(agent.id);
      const agentStatus = liveRun ? (liveRun.liveCount > 0 ? "running" : agent.status) : agent.status;
      showBubble(agent.id, getReportInResponse({
        name: agent.id,
        role: agent.role,
        title: agent.title,
        status: agentStatus,
        issueTitle: issueTitleByAgent.get(agent.id),
        dept: agentDeptMap.get(agent.id),
      }));
    }
  }

  // Per-agent say hello
  function triggerSayHelloOne(agent: Agent) {
    const liveRun = liveRunByAgent.get(agent.id);
    const agentStatus = liveRun ? "running" : agent.status;
    showBubble(agent.id, getSayHelloResponse({
      name: agent.id,
      role: agent.role,
      title: agent.title,
      status: agentStatus,
      dept: agentDeptMap.get(agent.id),
    }));
    fetch(`/api/agents/${agent.id}/heartbeat/invoke`, { method: "POST" }).catch(() => {});
  }

  // Per-agent report in
  function triggerReportInOne(agent: Agent) {
    const liveRun = liveRunByAgent.get(agent.id);
    const agentStatus = liveRun ? "running" : agent.status;
    showBubble(agent.id, getReportInResponse({
      name: agent.id,
      role: agent.role,
      title: agent.title,
      status: agentStatus,
      issueTitle: issueTitleByAgent.get(agent.id),
      dept: agentDeptMap.get(agent.id),
    }));
  }

  useEffect(() => {
    setBreadcrumbs([{ label: "Agents" }]);
  }, [setBreadcrumbs]);

  if (!selectedCompanyId) {
    return <EmptyState icon={Bot} message="Select a company to view agents." />;
  }

  if (isLoading) {
    return <PageSkeleton variant="list" />;
  }

  const filtered = filterAgents(agents ?? [], tab, showTerminated);
  const filteredOrg = filterOrgTree(orgTree ?? [], tab, showTerminated);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => navigate(`/agents/${v}`)}>
          <PageTabBar
            items={[
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "error", label: "Error" },
            ]}
            value={tab}
            onValueChange={(v) => navigate(`/agents/${v}`)}
          />
        </Tabs>
        <div className="flex items-center gap-2">
          {/* Say Hello to All */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => sayHelloMutation.mutate()}
            disabled={sayHelloMutation.isPending || !agents || agents.length === 0}
            className="gap-1.5"
          >
            {sayHelloMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageCircle className="h-3.5 w-3.5" />
            )}
            Say Hello
          </Button>
          {/* Report in */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerReportIn(filtered)}
            disabled={!agents || filtered.length === 0}
            className="gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            Report in
          </Button>
          {/* Recess */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => recessMutation.mutate()}
            disabled={recessMutation.isPending || !agents || agents.filter((a) => a.status !== "terminated" && a.status !== "paused" && a.status !== "pending_approval").length === 0}
            className="gap-1.5"
          >
            {recessMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            Recess
          </Button>
          {/* Resume */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => resumeAllMutation.mutate()}
            disabled={resumeAllMutation.isPending || !agents || agents.filter((a) => a.status === "paused").length === 0}
            className="gap-1.5"
          >
            {resumeAllMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Resume
          </Button>
          {/* Filters */}
          <div className="relative">
            <button
              className={cn(
                "flex items-center gap-1.5 px-2 py-1.5 text-xs transition-colors border border-border",
                filtersOpen || showTerminated ? "text-foreground bg-accent" : "text-muted-foreground hover:bg-accent/50"
              )}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <SlidersHorizontal className="h-3 w-3" />
              Filters
              {showTerminated && <span className="ml-0.5 px-1 bg-foreground/10 rounded text-[10px]">1</span>}
            </button>
            {filtersOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 w-48 border border-border bg-popover shadow-md p-1">
                <button
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-left hover:bg-accent/50 transition-colors"
                  onClick={() => setShowTerminated(!showTerminated)}
                >
                  <span className={cn(
                    "flex items-center justify-center h-3.5 w-3.5 border border-border rounded-sm",
                    showTerminated && "bg-foreground"
                  )}>
                    {showTerminated && <span className="text-background text-[10px] leading-none">&#10003;</span>}
                  </span>
                  Show terminated
                </button>
              </div>
            )}
          </div>
          {/* View toggle */}
          {!forceListView && (
            <div className="flex items-center border border-border">
              <button
                className={cn(
                  "p-1.5 transition-colors",
                  effectiveView === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn(
                  "p-1.5 transition-colors",
                  effectiveView === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => setView("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn(
                  "p-1.5 transition-colors",
                  effectiveView === "org" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
                onClick={() => setView("org")}
              >
                <GitBranch className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <Button size="sm" variant="outline" onClick={openNewAgent}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Agent
          </Button>
        </div>
      </div>

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground">{filtered.length} agent{filtered.length !== 1 ? "s" : ""}</p>
      )}

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {agents && agents.length === 0 && (
        <EmptyState
          icon={Bot}
          message="Create your first agent to get started."
          action="New Agent"
          onAction={openNewAgent}
        />
      )}

      {/* List view — grouped by department */}
      {effectiveView === "list" && filtered.length > 0 && (
        <div className="space-y-4">
          {[...agentsByDept.map.entries()].map(([deptName, deptAgents]) => (
            <div key={deptName} className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                {deptName}
              </h4>
              <div className="border border-border">
                {deptAgents.map((agent) => (
                  <AgentListRow
                    key={agent.id}
                    agent={agent}
                    liveRunByAgent={liveRunByAgent}
                    issueTitle={issueTitleByAgent.get(agent.id)}
                    bubble={bubbles.get(agent.id)}
                    onSayHello={() => triggerSayHelloOne(agent)}
                    onReportIn={() => triggerReportInOne(agent)}
                  />
                ))}
              </div>
            </div>
          ))}
          {agentsByDept.ungrouped.length > 0 && (
            <div className="space-y-1">
              {agentsByDept.map.size > 0 && (
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
                  Ungrouped
                </h4>
              )}
              <div className="border border-border">
                {agentsByDept.ungrouped.map((agent) => (
                  <AgentListRow
                    key={agent.id}
                    agent={agent}
                    liveRunByAgent={liveRunByAgent}
                    issueTitle={issueTitleByAgent.get(agent.id)}
                    bubble={bubbles.get(agent.id)}
                    onSayHello={() => triggerSayHelloOne(agent)}
                    onReportIn={() => triggerReportInOne(agent)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {effectiveView === "list" && agents && agents.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No agents match the selected filter.
        </p>
      )}

      {/* Grid view — rich cards */}
      {effectiveView === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((agent) => (
            <AgentGridCard
              key={agent.id}
              agent={agent}
              liveRunByAgent={liveRunByAgent}
              dept={agentDeptMap.get(agent.id)}
              issueTitle={issueTitleByAgent.get(agent.id)}
              bubble={bubbles.get(agent.id)}
              onSayHello={() => triggerSayHelloOne(agent)}
              onReportIn={() => triggerReportInOne(agent)}
            />
          ))}
        </div>
      )}

      {effectiveView === "grid" && agents && agents.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No agents match the selected filter.
        </p>
      )}

      {/* Org chart view */}
      {effectiveView === "org" && filteredOrg.length > 0 && (
        <div className="border border-border py-1">
          {filteredOrg.map((node) => (
            <OrgTreeNode key={node.id} node={node} depth={0} agentMap={agentMap} liveRunByAgent={liveRunByAgent} />
          ))}
        </div>
      )}

      {effectiveView === "org" && orgTree && orgTree.length > 0 && filteredOrg.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No agents match the selected filter.
        </p>
      )}

      {effectiveView === "org" && orgTree && orgTree.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No organizational hierarchy defined.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentGridCard — rich card for grid view
// ---------------------------------------------------------------------------

function AgentGridCard({
  agent,
  liveRunByAgent,
  dept,
  issueTitle,
  bubble,
  onSayHello,
  onReportIn,
}: {
  agent: Agent;
  liveRunByAgent: Map<string, { runId: string; liveCount: number }>;
  dept?: string;
  issueTitle?: string;
  bubble?: { text: string; thinking: boolean };
  onSayHello: () => void;
  onReportIn: () => void;
}) {
  const liveRun = liveRunByAgent.get(agent.id);
  const isLive = !!liveRun;

  return (
    <div className={cn(
      "relative flex flex-col rounded-xl border transition-shadow",
      isLive ? "border-cyan-500/40 bg-cyan-500/[0.03]" : "border-border bg-background hover:shadow-sm",
    )}>
      {bubble && <SpeechBubble text={bubble.text} thinking={bubble.thinking} />}

      {/* Clickable top section → agent page */}
      <Link
        to={agentUrl(agent)}
        className="flex flex-col items-center gap-2 pt-4 pb-2 px-3 no-underline text-inherit"
      >
        {/* Avatar with status dot */}
        <div className="relative">
          <AgentIcon
            icon={agent.icon}
            avatarUrl={agent.avatarUrl}
            className="h-14 w-14 rounded-full object-cover"
          />
          <span className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            agentStatusDot[agent.status] ?? agentStatusDotDefault,
            isLive && "animate-pulse",
          )} />
        </div>

        {/* Name + role */}
        <div className="text-center w-full min-w-0">
          <div className="text-sm font-semibold truncate">{agent.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {roleLabels[agent.role] ?? agent.role}
          </div>
          {agent.title && (
            <div className="text-[10px] text-muted-foreground/60 italic truncate">{agent.title}</div>
          )}
        </div>
      </Link>

      {/* Detail rows */}
      <div className="px-3 pb-2 space-y-1.5 text-[11px] min-w-0">
        {/* Department */}
        {dept && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="shrink-0 font-medium text-[10px] uppercase tracking-wide w-14">Dept</span>
            <span className="truncate px-1.5 py-0.5 rounded bg-muted/60 border border-border/60 text-[10px]">{dept}</span>
          </div>
        )}

        {/* Current issue */}
        {issueTitle && (
          <div className="flex items-start gap-1.5 text-muted-foreground">
            <span className="shrink-0 font-medium text-[10px] uppercase tracking-wide w-14 pt-px">Task</span>
            <span className="truncate text-foreground/80 leading-tight">{issueTitle}</span>
          </div>
        )}

        {/* Current state */}
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 font-medium text-[10px] uppercase tracking-wide text-muted-foreground w-14">State</span>
          <StatusBadge status={agent.status} />
          {isLive && (
            <LiveRunIndicator
              agentRef={agentRouteRef(agent)}
              runId={liveRun.runId}
              liveCount={liveRun.liveCount}
            />
          )}
        </div>

        {/* Last action */}
        {agent.lastHeartbeatAt && (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="shrink-0 font-medium text-[10px] uppercase tracking-wide w-14">Last</span>
            <Clock className="h-3 w-3 shrink-0" />
            <span>{relativeTime(agent.lastHeartbeatAt)}</span>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
        <button
          type="button"
          title="Say Hello"
          onClick={(e) => { e.preventDefault(); onSayHello(); }}
          className="flex-1 flex items-center justify-center gap-1 rounded py-1 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Hello
        </button>
        <div className="w-px h-4 bg-border/60" />
        <button
          type="button"
          title="Report in"
          onClick={(e) => { e.preventDefault(); onReportIn(); }}
          className="flex-1 flex items-center justify-center gap-1 rounded py-1 text-[11px] text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          Report
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentListRow
// ---------------------------------------------------------------------------

function AgentListRow({
  agent,
  liveRunByAgent,
  issueTitle,
  bubble,
  onSayHello,
  onReportIn,
}: {
  agent: Agent;
  liveRunByAgent: Map<string, { runId: string; liveCount: number }>;
  issueTitle?: string;
  bubble?: { text: string; thinking: boolean };
  onSayHello: () => void;
  onReportIn: () => void;
}) {
  return (
    <div className="relative">
      {bubble && <SpeechBubble text={bubble.text} thinking={bubble.thinking} />}
      <EntityRow
        title={agent.name}
        subtitle={`${roleLabels[agent.role] ?? agent.role}${agent.title ? ` - ${agent.title}` : ""}`}
        afterSubtitle={issueTitle ? (
          <span className="text-cyan-600 dark:text-cyan-400 truncate text-xs">{issueTitle}</span>
        ) : undefined}
        to={agentUrl(agent)}
        leading={
          <span className="relative flex items-center gap-2">
            <AgentIcon
              icon={agent.icon}
              avatarUrl={agent.avatarUrl}
              className="h-6 w-6 rounded-full object-cover"
            />
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${agentStatusDot[agent.status] ?? agentStatusDotDefault}`}
              />
            </span>
          </span>
        }
        trailing={
          <div className="flex items-center gap-2">
            {/* Per-row action buttons */}
            <button
              type="button"
              title="Say Hello"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onSayHello(); }}
              className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Report in"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onReportIn(); }}
              className="p-1 rounded text-muted-foreground/50 hover:text-foreground hover:bg-accent/60 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
            <div className="flex items-center gap-3">
              <span className="sm:hidden">
                {liveRunByAgent.has(agent.id) ? (
                  <LiveRunIndicator
                    agentRef={agentRouteRef(agent)}
                    runId={liveRunByAgent.get(agent.id)!.runId}
                    liveCount={liveRunByAgent.get(agent.id)!.liveCount}
                  />
                ) : (
                  <StatusBadge status={agent.status} />
                )}
              </span>
              <div className="hidden sm:flex items-center gap-3">
                {liveRunByAgent.has(agent.id) && (
                  <LiveRunIndicator
                    agentRef={agentRouteRef(agent)}
                    runId={liveRunByAgent.get(agent.id)!.runId}
                    liveCount={liveRunByAgent.get(agent.id)!.liveCount}
                  />
                )}
                <span className="text-xs text-muted-foreground font-mono w-14 text-right">
                  {adapterLabels[agent.adapterType] ?? agent.adapterType}
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {agent.lastHeartbeatAt ? relativeTime(agent.lastHeartbeatAt) : "—"}
                </span>
                <span className="w-20 flex justify-end">
                  <StatusBadge status={agent.status} />
                </span>
              </div>
            </div>
          </div>
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrgTreeNode
// ---------------------------------------------------------------------------

function OrgTreeNode({
  node,
  depth,
  agentMap,
  liveRunByAgent,
}: {
  node: OrgNode;
  depth: number;
  agentMap: Map<string, Agent>;
  liveRunByAgent: Map<string, { runId: string; liveCount: number }>;
}) {
  const agent = agentMap.get(node.id);
  const statusColor = agentStatusDot[node.status] ?? agentStatusDotDefault;

  return (
    <div style={{ paddingLeft: depth * 24 }}>
      <Link
        to={agent ? agentUrl(agent) : `/agents/${node.id}`}
        className="flex items-center gap-3 px-3 py-2 hover:bg-accent/30 transition-colors w-full text-left no-underline text-inherit"
      >
        {agent ? (
          <AgentIcon
            icon={agent.icon}
            avatarUrl={agent.avatarUrl}
            className="h-6 w-6 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full ${statusColor}`} />
          </span>
        )}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className={`absolute inline-flex h-full w-full rounded-full ${statusColor}`} />
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium">{node.name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {roleLabels[node.role] ?? node.role}
            {agent?.title ? ` - ${agent.title}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="sm:hidden">
            {liveRunByAgent.has(node.id) ? (
              <LiveRunIndicator
                agentRef={agent ? agentRouteRef(agent) : node.id}
                runId={liveRunByAgent.get(node.id)!.runId}
                liveCount={liveRunByAgent.get(node.id)!.liveCount}
              />
            ) : (
              <StatusBadge status={node.status} />
            )}
          </span>
          <div className="hidden sm:flex items-center gap-3">
            {liveRunByAgent.has(node.id) && (
              <LiveRunIndicator
                agentRef={agent ? agentRouteRef(agent) : node.id}
                runId={liveRunByAgent.get(node.id)!.runId}
                liveCount={liveRunByAgent.get(node.id)!.liveCount}
              />
            )}
            {agent && (
              <>
                <span className="text-xs text-muted-foreground font-mono w-14 text-right">
                  {adapterLabels[agent.adapterType] ?? agent.adapterType}
                </span>
                <span className="text-xs text-muted-foreground w-16 text-right">
                  {agent.lastHeartbeatAt ? relativeTime(agent.lastHeartbeatAt) : "—"}
                </span>
              </>
            )}
            <span className="w-20 flex justify-end">
              <StatusBadge status={node.status} />
            </span>
          </div>
        </div>
      </Link>
      {node.reports && node.reports.length > 0 && (
        <div className="border-l border-border/50 ml-4">
          {node.reports.map((child) => (
            <OrgTreeNode key={child.id} node={child} depth={depth + 1} agentMap={agentMap} liveRunByAgent={liveRunByAgent} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LiveRunIndicator
// ---------------------------------------------------------------------------

function LiveRunIndicator({
  agentRef,
  runId,
  liveCount,
}: {
  agentRef: string;
  runId: string;
  liveCount: number;
}) {
  return (
    <Link
      to={`/agents/${agentRef}/runs/${runId}`}
      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 hover:bg-blue-500/20 transition-colors no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
      <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
        Live{liveCount > 1 ? ` (${liveCount})` : ""}
      </span>
    </Link>
  );
}
