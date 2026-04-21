import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  analyticsApi,
  experimentsApi,
  type ObservationCreateRequest,
} from "../api/agentKpis";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Users,
  Activity,
  Plus,
  Trash2,
  Eye,
  FlaskConical,
} from "lucide-react";

const experimentStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  paused: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function Analytics() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const companyId = selectedCompanyId!;

  const [obsDialogOpen, setObsDialogOpen] = useState(false);
  const [obsForm, setObsForm] = useState({ observation: "", actionNotes: "" });
  const [deleteObsConfirm, setDeleteObsConfirm] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "Analytics" }]);
  }, [setBreadcrumbs]);

  const analyticsQuery = useQuery({
    queryKey: queryKeys.companyAnalytics(companyId),
    queryFn: () => analyticsApi.getCompanyAnalytics(companyId),
    enabled: !!companyId,
  });

  const observationsQuery = useQuery({
    queryKey: queryKeys.observations.list(companyId),
    queryFn: () => analyticsApi.listObservations(companyId),
    enabled: !!companyId,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const createObsMutation = useMutation({
    mutationFn: (data: ObservationCreateRequest) => analyticsApi.createObservation(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.observations.list(companyId) });
      pushToast({ title: "Observation created" });
      setObsDialogOpen(false);
      setObsForm({ observation: "", actionNotes: "" });
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to create observation" }),
  });

  const deleteObsMutation = useMutation({
    mutationFn: (id: string) => analyticsApi.deleteObservation(companyId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.observations.list(companyId) });
      pushToast({ title: "Observation deleted" });
      setDeleteObsConfirm(null);
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to delete observation" }),
  });

  const analytics = analyticsQuery.data;
  const observations = observationsQuery.data ?? [];
  const agents = agentsQuery.data ?? [];
  const agentSummaries = analytics?.agentSummaries ?? [];

  // Collect experiments for all agents
  const agentIds = agents.map((a) => a.id);

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  }

  if (!companyId) return null;
  if (analyticsQuery.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-lg font-semibold">Analytics</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Company-wide performance analytics and insights.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={Activity}
          label="Total Runs"
          value={analytics ? String(analytics.totalRuns) : "--"}
        />
        <SummaryCard
          icon={TrendingUp}
          label="Avg Completion Rate"
          value={
            analytics?.avgCompletionRate != null
              ? `${Math.round(analytics.avgCompletionRate * 100)}%`
              : "--"
          }
        />
        <SummaryCard
          icon={DollarSign}
          label="Total Cost"
          value={analytics?.totalCostCents != null ? formatCents(analytics.totalCostCents) : "--"}
        />
        <SummaryCard
          icon={Users}
          label="Active Agents"
          value={analytics ? String(analytics.activeAgents) : "--"}
        />
      </div>

      {/* Agent Comparison */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Agent Comparison</h3>
        {agentSummaries.length === 0 ? (
          <EmptySection icon={BarChart3} message="No agent performance data available yet." />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Agent</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Completion Rate
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Avg Cost</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Avg Duration
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Total Runs
                  </th>
                </tr>
              </thead>
              <tbody>
                {agentSummaries.map((trend) => (
                  <tr key={trend.agentId} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 font-medium">{trend.agentName}</td>
                    <td className="px-3 py-2">
                      {Math.round(trend.completionRate * 100)}%
                    </td>
                    <td className="px-3 py-2">{formatCents(Math.round(trend.avgCostCents))}</td>
                    <td className="px-3 py-2">{formatDuration(trend.avgDurationSeconds * 1000)}</td>
                    <td className="px-3 py-2">{trend.totalRuns}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Observations */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Observations</h3>
          <Button size="sm" variant="outline" onClick={() => setObsDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Observation
          </Button>
        </div>

        {observations.length === 0 ? (
          <EmptySection icon={Eye} message="No observations recorded yet." />
        ) : (
          <div className="space-y-2">
            {observations.map((obs) => {
              const firstAgentId = obs.agentIds[0];
              const agentName = firstAgentId
                ? agents.find((a) => a.id === firstAgentId)?.name ?? "Unknown"
                : "Company-wide";
              return (
                <Card key={obs.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {obs.observerType}
                        </Badge>
                        {obs.actionTaken && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            action taken
                          </Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">{agentName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{obs.observation}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive shrink-0"
                      onClick={() => setDeleteObsConfirm(obs.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Experiments grouped by agent */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Experiments</h3>
        {agents.length === 0 ? (
          <EmptySection icon={FlaskConical} message="No agents available." />
        ) : (
          <div className="space-y-6">
            {agents.map((agent) => (
              <AgentExperimentsSection key={agent.id} agentId={agent.id} agentName={agent.name} />
            ))}
          </div>
        )}
      </section>

      {/* Observation Dialog */}
      <Dialog open={obsDialogOpen} onOpenChange={(open) => !open && setObsDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Observation</DialogTitle>
            <DialogDescription>Record a company-wide observation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Observation</label>
              <Textarea
                value={obsForm.observation}
                onChange={(e) => setObsForm({ ...obsForm, observation: e.target.value })}
                placeholder="Describe the observation..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Action Notes (optional)</label>
              <Input
                value={obsForm.actionNotes}
                onChange={(e) => setObsForm({ ...obsForm, actionNotes: e.target.value })}
                placeholder="Any action taken..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setObsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createObsMutation.mutate({
                  observerType: "board_human",
                  observation: obsForm.observation,
                  actionTaken: obsForm.actionNotes.trim().length > 0,
                  actionNotes: obsForm.actionNotes.trim() || undefined,
                })
              }
              disabled={!obsForm.observation.trim() || createObsMutation.isPending}
            >
              {createObsMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Observation Confirmation */}
      <Dialog open={!!deleteObsConfirm} onOpenChange={(open) => !open && setDeleteObsConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Observation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this observation?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteObsConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteObsConfirm && deleteObsMutation.mutate(deleteObsConfirm)}
              disabled={deleteObsMutation.isPending}
            >
              {deleteObsMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AgentExperimentsSection({
  agentId,
  agentName,
}: {
  agentId: string;
  agentName: string;
}) {
  const experimentsQuery = useQuery({
    queryKey: queryKeys.experiments.list(agentId),
    queryFn: () => experimentsApi.list(agentId),
  });

  const experiments = experimentsQuery.data ?? [];

  if (experiments.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-medium text-muted-foreground mb-2">{agentName}</h4>
      <div className="space-y-2">
        {experiments.map((exp) => (
          <Card key={exp.id} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
              <h5 className="text-sm font-medium truncate">{exp.hypothesis}</h5>
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  experimentStatusColors[exp.status],
                )}
              >
                {exp.status}
              </Badge>
            </div>
            {(exp.changeNotes ?? exp.approachA) && (
              <p className="text-xs text-muted-foreground line-clamp-1 ml-5">
                {exp.changeNotes ?? exp.approachA}
              </p>
            )}
            {exp.winningApproach && (
              <p className="text-xs text-green-600 dark:text-green-400 ml-5 mt-0.5 line-clamp-1">
                Winner: {exp.winningApproach}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </Card>
  );
}

function EmptySection({ icon: Icon, message }: { icon: typeof BarChart3; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/30 mb-2" />
      <p className="text-xs text-muted-foreground">{message}</p>
    </div>
  );
}
