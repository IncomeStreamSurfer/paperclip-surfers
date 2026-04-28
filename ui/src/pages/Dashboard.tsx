import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link } from "@/lib/router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { sprintApi } from "../api/sprints";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, ChevronRight, CircleDot, ChevronsDownUp, ChevronsUpDown, DollarSign, ShieldCheck, LayoutDashboard, PauseCircle, Settings2 } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import {
  RunActivityChart,
  PriorityChart,
  IssueStatusChart,
  SuccessRateChart,
  TokenUsageChart,
  BurndownChart,
  TasksByAgentChart,
  AgentTimeChart,
  IssuesByProjectChart,
  CycleTimeWidget,
  CostTrendChart,
  AgentStatusChart,
  BlockedIssuesWidget,
  ProjectHealthWidget,
  SprintOverviewWidget,
  WorldClockWidget,
} from "../components/ActivityCharts";
import { DashboardWidgetWrapper } from "../components/DashboardWidgetWrapper";
import { WidgetCustomizePanel } from "../components/WidgetCustomizePanel";

import { PageSkeleton } from "../components/PageSkeleton";
import type { Agent, Issue } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";
import { WIDGET_REGISTRY } from "../lib/dashboard-widgets";
import { useDashboardConfig } from "../hooks/useDashboardConfig";

/* ---- Time filter ---- */

const TIME_OPTIONS = [
  { label: "Today", days: 1 },
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

function daysLabel(days: number): string {
  return TIME_OPTIONS.find((o) => o.days === days)?.label ?? `${days}d`;
}

function DashboardTimeFilter({
  days,
  onChange,
}: {
  days: number;
  onChange: (d: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {TIME_OPTIONS.map((opt) => (
        <button
          key={opt.days}
          onClick={() => onChange(opt.days)}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-medium transition-colors",
            days === opt.days
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted/60",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ---- Helpers ---- */

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

/* ---- Dashboard ---- */

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();

  /* activity animation state */
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);

  /* time filter */
  const [days, setDays] = useState<number>(30);

  /* auto-refresh settings */
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    try { return localStorage.getItem("paperclip_dashboard_auto_refresh") === "true"; } catch { return false; }
  });
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState(() => {
    try { return parseInt(localStorage.getItem("paperclip_dashboard_refresh_interval") ?? "30", 10); } catch { return 30; }
  });
  const [countdown, setCountdown] = useState(autoRefreshIntervalSec);
  const queryClient = useQueryClient();

  useEffect(() => {
    try { localStorage.setItem("paperclip_dashboard_auto_refresh", String(autoRefreshEnabled)); } catch {}
  }, [autoRefreshEnabled]);

  useEffect(() => {
    try { localStorage.setItem("paperclip_dashboard_refresh_interval", String(autoRefreshIntervalSec)); } catch {}
  }, [autoRefreshIntervalSec]);

  useEffect(() => {
    setCountdown(autoRefreshIntervalSec);
  }, [autoRefreshIntervalSec, autoRefreshEnabled]);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          return autoRefreshIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [autoRefreshEnabled, autoRefreshIntervalSec]);

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.activity(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.projects.list(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.heartbeats(selectedCompanyId!) });
    queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
    setCountdown(autoRefreshIntervalSec);
  };

  const refetchInterval = autoRefreshEnabled ? autoRefreshIntervalSec * 1000 : false;

  /* selected company business type (for widget defaults) */
  const selectedCompany = useMemo(
    () => companies.find((c) => c.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );

  /* widget config — scoped per company */
  const {
    order, disabled, disableWidget, enableWidget, reorder, reset,
    sections, widgetSections, addSection, deleteSection, renameSection,
    toggleSection, collapseAll, expandAll, assignWidgetToSection,
  } = useDashboardConfig(
    selectedCompanyId ?? null,
    selectedCompany?.businessType ?? null,
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);

  /* DnD sensors */
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  /* ---- Queries ---- */

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: runs } = useQuery({
    queryKey: [...queryKeys.heartbeats(selectedCompanyId!), days],
    queryFn: () => heartbeatsApi.list(selectedCompanyId!, undefined, undefined, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: tokenUsage } = useQuery({
    queryKey: [...queryKeys.dashboardTokenUsage(selectedCompanyId!), days],
    queryFn: () => dashboardApi.tokenUsage(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: burndown } = useQuery({
    queryKey: [...queryKeys.dashboardBurndown(selectedCompanyId!), days],
    queryFn: () => dashboardApi.burndown(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: tasksByAgent } = useQuery({
    queryKey: [...queryKeys.dashboardTasksByAgent(selectedCompanyId!), days],
    queryFn: () => dashboardApi.tasksByAgent(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: agentTime } = useQuery({
    queryKey: [...queryKeys.dashboardAgentTime(selectedCompanyId!), days],
    queryFn: () => dashboardApi.agentTime(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: issuesByProject } = useQuery({
    queryKey: [...queryKeys.dashboardIssuesByProject(selectedCompanyId!), days],
    queryFn: () => dashboardApi.issuesByProject(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: cycleTime } = useQuery({
    queryKey: [...queryKeys.dashboardCycleTime(selectedCompanyId!), days],
    queryFn: () => dashboardApi.cycleTime(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: costTrend } = useQuery({
    queryKey: [...queryKeys.dashboardCostTrend(selectedCompanyId!), days],
    queryFn: () => dashboardApi.costTrend(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: projectHealth } = useQuery({
    queryKey: [...queryKeys.dashboardProjectHealth(selectedCompanyId!), days],
    queryFn: () => dashboardApi.projectHealth(selectedCompanyId!, days),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: sprintsData } = useQuery({
    queryKey: queryKeys.sprints.list(selectedCompanyId!),
    queryFn: () => sprintApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  /* ---- Derived ---- */

  // Issues filtered to the selected time window (for chart widgets)
  const filteredIssues = useMemo(() => {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    return (issues ?? []).filter((i) => new Date(i.updatedAt).getTime() >= since);
  }, [issues, days]);

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);

  /* ---- Activity animation ---- */

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) window.clearTimeout(timer);
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;
    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);
    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }
    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }
    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });
    for (const id of newIds) seen.add(id);
    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) window.clearTimeout(timer);
    };
  }, []);

  /* ---- Maps ---- */

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  /* ---- DnD ---- */

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIdx = order.indexOf(String(active.id));
      const newIdx = order.indexOf(String(over.id));
      if (oldIdx === -1 || newIdx === -1) return;
      const next = [...order];
      next.splice(oldIdx, 1);
      next.splice(newIdx, 0, String(active.id));
      reorder(next);
    },
    [order, reorder],
  );

  /* ---- Widget renderer ---- */

  const renderWidget = useCallback(
    (id: string) => {
      const def = WIDGET_REGISTRY.find((w) => w.id === id);
      if (!def) return null;

      const label = daysLabel(days);
      let content: React.ReactNode = null;
      let subtitle = def.subtitle;

      switch (id) {
        case "run-activity":
          content = <RunActivityChart runs={runs ?? []} />;
          subtitle = `Last ${label}`;
          break;
        case "priority-chart":
          content = <PriorityChart issues={filteredIssues} />;
          subtitle = `Last ${label} · by priority`;
          break;
        case "status-chart":
          content = <IssueStatusChart issues={filteredIssues} />;
          subtitle = `Last ${label} · by status`;
          break;
        case "success-rate":
          content = <SuccessRateChart runs={runs ?? []} />;
          subtitle = `Last ${label}`;
          break;
        case "token-usage":
          content = tokenUsage ? (
            <TokenUsageChart data={tokenUsage} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label} · by agent`;
          break;
        case "burndown":
          content = burndown ? (
            <BurndownChart data={burndown} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Opened vs closed · Last ${label}`;
          break;
        case "tasks-by-agent":
          content = tasksByAgent ? (
            <TasksByAgentChart data={tasksByAgent} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label} · open / in-progress / done`;
          break;
        case "agent-time":
          content = agentTime ? (
            <AgentTimeChart data={agentTime} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label} · wall-clock`;
          break;
        case "issues-by-project":
          content = issuesByProject ? (
            <IssuesByProjectChart data={issuesByProject} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label}`;
          break;
        case "cycle-time":
          content = cycleTime ? (
            <CycleTimeWidget data={cycleTime} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label}`;
          break;
        case "cost-trend":
          content = costTrend ? (
            <CostTrendChart data={costTrend} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label} · daily spend`;
          break;
        case "agent-status":
          content = <AgentStatusChart agents={agents ?? []} />;
          break;
        case "blocked-issues":
          content = (
            <BlockedIssuesWidget
              issues={(issues ?? []).map((i) => ({
                id: i.id,
                identifier: i.identifier,
                title: i.title,
                assigneeAgentId: i.assigneeAgentId,
                status: i.status,
              }))}
            />
          );
          break;
        case "project-health":
          content = projectHealth ? (
            <ProjectHealthWidget data={projectHealth} />
          ) : (
            <p className="text-xs text-muted-foreground">Loading…</p>
          );
          subtitle = `Last ${label}`;
          break;
        case "sprint-overview":
          content = <SprintOverviewWidget sprints={sprintsData?.sprints ?? []} />;
          subtitle = "Active & planning sprints";
          break;
        case "world-clock":
          content = <WorldClockWidget />;
          subtitle = "Saved Time Zones";
          break;
        default:
          return null;
      }

      return (
        <DashboardWidgetWrapper
          key={id}
          id={id}
          title={def.title}
          subtitle={subtitle}
          size={def.size}
          editMode={customizeOpen}
          onRemove={disableWidget}
        >
          {content}
        </DashboardWidgetWrapper>
      );
    },
    [
      days, runs, issues, filteredIssues, tokenUsage, burndown, tasksByAgent, agentTime,
      issuesByProject, cycleTime, costTrend, agents, projectHealth,
      customizeOpen, disableWidget,
    ],
  );

  /* ---- Derived (must be before early returns — Rules of Hooks) ---- */

  const hasNoAgents = agents !== undefined && agents.length === 0;
  const enabledOrder = order.filter((id) => !disabled.has(id));

  // Group enabled widgets by section; ungrouped at the end
  const { sectionWidgetMap, ungroupedWidgets } = useMemo(() => {
    const sectionWidgetMap = new Map<string, string[]>();
    const ungroupedWidgets: string[] = [];
    for (const id of enabledOrder) {
      const sId = widgetSections[id];
      if (sId) {
        if (!sectionWidgetMap.has(sId)) sectionWidgetMap.set(sId, []);
        sectionWidgetMap.get(sId)!.push(id);
      } else {
        ungroupedWidgets.push(id);
      }
    }
    return { sectionWidgetMap, ungroupedWidgets };
  }, [enabledOrder, widgetSections]);

  /* ---- Early returns ---- */

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) return <PageSkeleton variant="dashboard" />;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">You have no agents.</p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} agents={agents ?? []} />

      {data && (
        <>
          {data.budgets.activeIncidents > 0 && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p className="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-100/70">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused ·{" "}
                    {data.budgets.pendingApprovals} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" className="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          )}

          {/* Metric cards */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Bot}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Agents Enabled"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                    : "Unlimited budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals + data.budgets.pendingApprovals}
              label="Pending Approvals"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          {/* Chart toolbar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DashboardTimeFilter days={days} onChange={setDays} />
            <div className="flex items-center gap-1">
              {sections.length > 0 && (
                <>
                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-muted/60 px-2 py-1 rounded font-medium transition-colors"
                    title="Expand all sections"
                  >
                    <ChevronsUpDown className="h-3 w-3" />
                    Expand all
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:bg-muted/60 px-2 py-1 rounded font-medium transition-colors"
                    title="Collapse all sections"
                  >
                    <ChevronsDownUp className="h-3 w-3" />
                    Collapse all
                  </button>
                </>
              )}
              <button
                onClick={() => setCustomizeOpen(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:bg-muted/60 px-2.5 py-1 rounded font-medium transition-colors"
              >
                <Settings2 className="h-3 w-3" />
                Customize
              </button>
            </div>
          </div>

          {/* Named sections */}
          {sections.map((section) => {
            const sWidgets = sectionWidgetMap.get(section.id) ?? [];
            if (sWidgets.length === 0) return null;
            return (
              <div key={section.id} className="space-y-2">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="flex items-center gap-1.5 w-full text-left group"
                >
                  <ChevronRight
                    className={cn(
                      "h-3.5 w-3.5 text-muted-foreground transition-transform duration-150",
                      !section.collapsed && "rotate-90",
                    )}
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
                    {section.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-0.5">
                    ({sWidgets.length})
                  </span>
                </button>
                {!section.collapsed && (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={sWidgets} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {sWidgets.map((id) => renderWidget(id))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            );
          })}

          {/* Ungrouped widgets */}
          {ungroupedWidgets.length > 0 && (
            <div className="space-y-2">
              {sections.length > 0 && (
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/40">
                  Ungrouped
                </p>
              )}
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={ungroupedWidgets} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {ungroupedWidgets.map((id) => renderWidget(id))}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {/* Plugin slot */}
          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-4 md:grid-cols-2"
            itemClassName="rounded-lg border bg-card p-4 shadow-sm"
          />

          {/* Recent Activity + Recent Tasks */}
          <div className="grid md:grid-cols-2 gap-4">
            {recentActivity.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Tasks
              </h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentIssues.slice(0, 10).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex">
                              <StatusIcon status={issue.status} />
                            </span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name ? (
                                <span className="hidden sm:inline-flex">
                                  <Identity name={name} size="sm" />
                                </span>
                              ) : null;
                            })()}
                            <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Widget customize sheet */}
      <WidgetCustomizePanel
        open={customizeOpen}
        onClose={() => setCustomizeOpen(false)}
        order={order}
        disabled={disabled}
        sections={sections}
        widgetSections={widgetSections}
        onReorder={reorder}
        onEnable={enableWidget}
        onDisable={disableWidget}
        onReset={reset}
        onAddSection={addSection}
        onDeleteSection={deleteSection}
        onRenameSection={renameSection}
        onAssignWidgetToSection={assignWidgetToSection}
      />
    </div>
  );
}
