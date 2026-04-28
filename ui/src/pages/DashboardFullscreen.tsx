/**
 * @fileoverview Full-screen dashboard mode for wall-mounted displays.
 *
 * - Fills the entire viewport with no scrolling
 * - Shows only live key stats: active agents, live runs, open issues, cost today, burndown
 * - Auto-refreshes every 10 seconds
 * - Toggle with `F` keyboard shortcut or button in regular Dashboard header
 * - Exits via `Esc` or clicking the exit button
 *
 * @see doc/plans/2026-04-26-pro-plus-roadmap.md §22.5
 */
import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@/lib/router";
import { dashboardApi } from "../api/dashboard";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { heartbeatsApi } from "../api/heartbeats";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { formatCents } from "../lib/utils";
import { BurndownChart } from "../components/ActivityCharts";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Bot,
  DollarSign,
  Loader2,
  Maximize2,
  X,
} from "lucide-react";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 h-full">
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function DashboardFullscreen() {
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        navigate("/dashboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  const refetchInterval = 10_000;

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: dashboard } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const { data: burndown } = useQuery({
    queryKey: [...queryKeys.dashboardBurndown(selectedCompanyId!), 30],
    queryFn: () => dashboardApi.burndown(selectedCompanyId!, 30),
    enabled: !!selectedCompanyId,
    refetchInterval,
  });

  const activeAgents = useMemo(
    () => agents?.filter((a) => a.status === "running" || a.status === "idle").length ?? 0,
    [agents],
  );

  const liveRuns = useMemo(
    () => runs?.filter((r) => r.status === "running").length ?? 0,
    [runs],
  );

  const openIssues = useMemo(
    () => issues?.filter((i) => i.status !== "done" && i.status !== "cancelled").length ?? 0,
    [issues],
  );

  const costToday = useMemo(() => {
    return dashboard?.costs.monthSpendCents ?? 0;
  }, [dashboard]);

  const isLoading = !agents || !dashboard || !issues || !runs || !burndown;

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col p-4 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">Live Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Auto-refresh every 10s</span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <X className="h-4 w-4 mr-1" />
            Exit
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
        <StatCard label="Active Agents" value={activeAgents} icon={Bot} />
        <StatCard label="Live Runs" value={liveRuns} icon={Activity} />
        <StatCard label="Open Issues" value={openIssues} icon={Maximize2} />
        <StatCard
          label="Cost This Month"
          value={formatCents(costToday)}
          icon={DollarSign}
        />
        <StatCard
          label="Total Agents"
          value={agents?.length ?? 0}
          sub={`${agents?.filter((a) => a.status === "paused").length ?? 0} paused`}
          icon={Bot}
        />
      </div>

      {/* Burndown chart fills remaining space */}
      <div className="flex-1 min-h-0 rounded-xl border border-border bg-card p-4 flex flex-col">
        <h2 className="text-sm font-medium mb-2 shrink-0">30-Day Burndown</h2>
        <div className="flex-1 min-h-0">
          <BurndownChart data={burndown} />
        </div>
      </div>
    </div>
  );
}
