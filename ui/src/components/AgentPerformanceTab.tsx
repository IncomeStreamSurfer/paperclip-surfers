import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  agentKpisApi,
  analyticsApi,
  experimentsApi,
  type ObservationCreateRequest,
  type ExperimentCreateRequest,
} from "../api/agentKpis";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { cn, formatCents } from "../lib/utils";
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
  Clock,
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
  concluded: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface AgentPerformanceTabProps {
  agentId: string;
  companyId: string;
}

export function AgentPerformanceTab({ agentId, companyId }: AgentPerformanceTabProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [obsDialogOpen, setObsDialogOpen] = useState(false);
  const [obsForm, setObsForm] = useState({ observation: "", actionNotes: "" });
  const [deleteObsConfirm, setDeleteObsConfirm] = useState<string | null>(null);

  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [expForm, setExpForm] = useState({ hypothesis: "", approachA: "", approachB: "" });
  const [deleteExpConfirm, setDeleteExpConfirm] = useState<string | null>(null);

  const kpisQuery = useQuery({
    queryKey: queryKeys.agentKpis.list(agentId),
    queryFn: () => agentKpisApi.list(agentId, { limit: 20 }),
  });

  const observationsQuery = useQuery({
    queryKey: queryKeys.observations.list(companyId),
    queryFn: () => analyticsApi.listObservations(companyId),
  });

  const experimentsQuery = useQuery({
    queryKey: queryKeys.experiments.list(agentId),
    queryFn: () => experimentsApi.list(agentId),
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

  const createExpMutation = useMutation({
    mutationFn: (data: ExperimentCreateRequest) => experimentsApi.create(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.list(agentId) });
      pushToast({ title: "Experiment created" });
      setExpDialogOpen(false);
      setExpForm({ hypothesis: "", approachA: "", approachB: "" });
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to create experiment" }),
  });

  const deleteExpMutation = useMutation({
    mutationFn: (id: string) => experimentsApi.delete(agentId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.list(agentId) });
      pushToast({ title: "Experiment deleted" });
      setDeleteExpConfirm(null);
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to delete experiment" }),
  });

  const kpis = kpisQuery.data ?? [];
  const observations = (observationsQuery.data ?? []).filter(
    (o) => o.agentIds.length === 0 || o.agentIds.includes(agentId),
  );
  const experiments = experimentsQuery.data ?? [];

  // Compute summary values from KPIs
  const completionKpis = kpis.filter((k) => k.taskCompleted != null);
  const completedCount = completionKpis.filter((k) => k.taskCompleted === true).length;
  const avgCompletion =
    completionKpis.length > 0 ? completedCount / completionKpis.length : null;

  const costs = kpis.filter((k) => k.costCents != null).map((k) => k.costCents!);
  const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null;

  const durationsMs = kpis
    .filter((k) => k.durationSeconds != null)
    .map((k) => k.durationSeconds! * 1000);
  const avgDuration =
    durationsMs.length > 0 ? durationsMs.reduce((a, b) => a + b, 0) / durationsMs.length : null;

  const totalRuns = kpis.length;

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60_000).toFixed(1)}m`;
  }

  return (
    <div className="space-y-8">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          icon={TrendingUp}
          label="Completion Rate"
          value={avgCompletion != null ? `${Math.round(avgCompletion * 100)}%` : "--"}
        />
        <SummaryCard
          icon={DollarSign}
          label="Avg Cost"
          value={avgCost != null ? formatCents(Math.round(avgCost)) : "--"}
        />
        <SummaryCard
          icon={Clock}
          label="Avg Duration"
          value={avgDuration != null ? formatDuration(avgDuration) : "--"}
        />
        <SummaryCard
          icon={Activity}
          label="Total Runs"
          value={String(totalRuns)}
        />
      </div>

      {/* Recent KPIs */}
      <section>
        <h3 className="text-sm font-semibold mb-3">Recent KPI Entries</h3>
        {kpis.length === 0 ? (
          <EmptySection icon={BarChart3} message="No KPI data recorded yet." />
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Completion</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Cost</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Duration</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Errors</th>
                </tr>
              </thead>
              <tbody>
                {kpis.map((kpi) => (
                  <tr key={kpi.id} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-muted-foreground">
                      {new Date(kpi.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-2">
                      {kpi.taskCompleted == null ? "--" : kpi.taskCompleted ? "Yes" : "No"}
                    </td>
                    <td className="px-3 py-2">
                      {kpi.costCents != null ? formatCents(kpi.costCents) : "--"}
                    </td>
                    <td className="px-3 py-2">
                      {kpi.durationSeconds != null
                        ? formatDuration(kpi.durationSeconds * 1000)
                        : "--"}
                    </td>
                    <td className="px-3 py-2">
                      {kpi.errorsEncountered > 0 ? (
                        <span className="text-destructive">{kpi.errorsEncountered}</span>
                      ) : (
                        "0"
                      )}
                    </td>
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
          <EmptySection icon={Eye} message="No observations recorded." />
        ) : (
          <div className="space-y-2">
            {observations.map((obs) => (
              <Card key={obs.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {obs.observerType}
                      </Badge>
                      {obs.actionTaken && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          action taken
                        </Badge>
                      )}
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
            ))}
          </div>
        )}
      </section>

      {/* Experiments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Experiments</h3>
          <Button size="sm" variant="outline" onClick={() => setExpDialogOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            New Experiment
          </Button>
        </div>

        {experiments.length === 0 ? (
          <EmptySection icon={FlaskConical} message="No experiments running." />
        ) : (
          <div className="space-y-2">
            {experiments.map((exp) => (
              <Card key={exp.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium truncate">{exp.hypothesis}</h4>
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
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {exp.changeNotes ?? exp.approachA}
                      </p>
                    )}
                    {exp.winningApproach && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 line-clamp-1">
                        Winner: {exp.winningApproach}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-destructive shrink-0"
                    onClick={() => setDeleteExpConfirm(exp.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Observation Dialog */}
      <Dialog open={obsDialogOpen} onOpenChange={(open) => !open && setObsDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Observation</DialogTitle>
            <DialogDescription>Record an observation about this agent's performance.</DialogDescription>
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
                  agentIds: [agentId],
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

      {/* Experiment Dialog */}
      <Dialog open={expDialogOpen} onOpenChange={(open) => !open && setExpDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Experiment</DialogTitle>
            <DialogDescription>Create an experiment to test a hypothesis.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hypothesis</label>
              <Textarea
                value={expForm.hypothesis}
                onChange={(e) => setExpForm({ ...expForm, hypothesis: e.target.value })}
                placeholder="What do you expect to happen?"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Approach A</label>
              <Textarea
                value={expForm.approachA}
                onChange={(e) => setExpForm({ ...expForm, approachA: e.target.value })}
                placeholder="Describe approach A..."
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Approach B</label>
              <Textarea
                value={expForm.approachB}
                onChange={(e) => setExpForm({ ...expForm, approachB: e.target.value })}
                placeholder="Describe approach B..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExpDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createExpMutation.mutate({
                  hypothesis: expForm.hypothesis,
                  approachA: expForm.approachA,
                  approachB: expForm.approachB,
                })
              }
              disabled={!expForm.hypothesis.trim() || !expForm.approachA.trim() || !expForm.approachB.trim() || createExpMutation.isPending}
            >
              {createExpMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Experiment Confirmation */}
      <Dialog open={!!deleteExpConfirm} onOpenChange={(open) => !open && setDeleteExpConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Experiment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this experiment?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteExpConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteExpConfirm && deleteExpMutation.mutate(deleteExpConfirm)}
              disabled={deleteExpMutation.isPending}
            >
              {deleteExpMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
