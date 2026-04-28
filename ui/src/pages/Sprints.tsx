import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { sprintApi, type Sprint } from "../api/sprints";
import { projectsApi } from "../api/projects";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { Link } from "@/lib/router";
import {
  Zap, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertCircle, BarChart2,
  FolderOpen, Link2, X, Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Issue, Project } from "@paperclipai/shared";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const ISSUE_STATUS_COLORS: Record<string, string> = {
  todo: "text-muted-foreground",
  "in-progress": "text-blue-600",
  done: "text-green-600",
  cancelled: "text-red-500",
};

// ─── Issues tab ──────────────────────────────────────────────────────────────

function SprintIssuesTab({
  sprint,
  companyId,
  projects,
}: {
  sprint: Sprint;
  companyId: string;
  projects: Project[];
}) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");

  const issuesQuery = useQuery({
    queryKey: queryKeys.sprints.issues(sprint.id),
    queryFn: () => sprintApi.listIssues(companyId, sprint.id),
  });

  // Candidate issues for the "Add" dialog: load by project if sprint has one, else all
  const candidateQuery = useQuery({
    queryKey: queryKeys.issues.list(companyId),
    queryFn: () =>
      issuesApi.list(companyId, sprint.projectId ? { projectId: sprint.projectId } : undefined),
    enabled: showAdd,
  });

  const sprintIssueIds = useMemo(
    () => new Set((issuesQuery.data?.issues ?? []).map((i) => i.id)),
    [issuesQuery.data],
  );

  const filteredCandidates = useMemo(() => {
    const all = (candidateQuery.data ?? []) as Issue[];
    const q = search.toLowerCase();
    return all.filter(
      (i) => !sprintIssueIds.has(i.id) && (!q || i.title.toLowerCase().includes(q)),
    );
  }, [candidateQuery.data, sprintIssueIds, search]);

  const addIssue = useMutation({
    mutationFn: (issueId: string) => sprintApi.addIssue(companyId, sprint.id, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.issues(sprint.id) });
    },
  });

  const removeIssue = useMutation({
    mutationFn: (issueId: string) => sprintApi.removeIssue(companyId, sprint.id, issueId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.issues(sprint.id) });
    },
  });

  const issues = (issuesQuery.data?.issues ?? []) as Issue[];

  const linkedProjects = useMemo(() => {
    const ids = new Set(issues.map((i) => i.projectId).filter(Boolean));
    return projects.filter((p) => ids.has(p.id));
  }, [issues, projects]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {issues.length} issue{issues.length !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => { setSearch(""); setShowAdd(true); }}
        >
          <Link2 className="h-3 w-3" /> Add Issue
        </Button>
      </div>

      {linkedProjects.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {linkedProjects.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground rounded-full border px-2 py-0.5"
            >
              <FolderOpen className="h-2.5 w-2.5" />
              {p.name}
            </span>
          ))}
        </div>
      )}

      {issuesQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : issues.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No issues linked yet. Click "Add Issue" to link one.
        </p>
      ) : (
        <div className="space-y-1">
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="flex items-center gap-2 rounded-md border px-3 py-1.5"
            >
              <span
                className={`text-xs font-mono shrink-0 ${ISSUE_STATUS_COLORS[issue.status] ?? "text-muted-foreground"}`}
              >
                {issue.identifier ?? issue.issueNumber ?? "—"}
              </span>
              <Link
                to={`/issues/${issue.identifier ?? issue.id}`}
                className="flex-1 text-xs truncate hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {issue.title}
              </Link>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {issue.status}
              </Badge>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeIssue.mutate(issue.id)}
                disabled={removeIssue.isPending}
                title="Remove from sprint"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Issue dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Issue to Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 text-sm"
                placeholder="Filter issues…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {candidateQuery.isLoading ? (
                <p className="text-xs text-muted-foreground px-2">Loading…</p>
              ) : filteredCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground px-2 italic">
                  {search ? "No matching issues" : "All issues already linked"}
                </p>
              ) : (
                filteredCandidates.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    className="w-full text-left flex items-center gap-2 rounded px-2 py-1.5 hover:bg-accent transition-colors"
                    onClick={() => {
                      addIssue.mutate(issue.id);
                      setShowAdd(false);
                    }}
                  >
                    <span className="text-xs font-mono text-muted-foreground shrink-0">
                      {issue.identifier ?? issue.issueNumber ?? "—"}
                    </span>
                    <span className="text-xs flex-1 truncate">{issue.title}</span>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {issue.status}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sprint card ──────────────────────────────────────────────────────────────

function SprintCard({
  sprint,
  companyId,
  projects,
  onDelete,
}: {
  sprint: Sprint;
  companyId: string;
  projects: Project[];
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"metrics" | "issues">("metrics");

  const project = projects.find((p) => p.id === sprint.projectId) ?? null;

  const velocityQuery = useQuery({
    queryKey: queryKeys.sprints.velocity(sprint.id),
    queryFn: () => sprintApi.velocity(companyId, sprint.id),
    enabled: expanded && tab === "metrics",
  });

  const generateReport = useMutation({
    mutationFn: () => sprintApi.generateReport(companyId, sprint.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(companyId) });
    },
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => sprintApi.update(companyId, sprint.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(companyId) });
    },
  });

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{sprint.name}</span>
            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${STATUS_COLORS[sprint.status] ?? ""}`}>
              {sprint.status}
            </span>
            {project && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground rounded-full border px-2 py-0.5">
                <FolderOpen className="h-3 w-3" />
                {project.name}
              </span>
            )}
          </div>
          {sprint.goal && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sprint.goal}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {sprint.startDate && (
              <span>Start: {new Date(sprint.startDate).toLocaleDateString()}</span>
            )}
            {sprint.endDate && (
              <span>End: {new Date(sprint.endDate).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Select
            value={sprint.status}
            onValueChange={(v) => updateStatus.mutate(v)}
          >
            <SelectTrigger className="h-7 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive"
            onClick={onDelete}
            title="Delete sprint"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="space-y-3 border-t pt-3">
          {/* Tab bar */}
          <div className="flex gap-2 border-b pb-2">
            {(["metrics", "issues"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${
                  tab === t
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setTab(t)}
              >
                {t === "metrics" ? "Velocity & Report" : "Issues"}
              </button>
            ))}
          </div>

          {tab === "metrics" && (
            <div className="space-y-3">
              {/* Velocity */}
              {velocityQuery.isLoading ? (
                <p className="text-xs text-muted-foreground">Loading velocity…</p>
              ) : velocityQuery.data ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Issues", value: velocityQuery.data.totalIssues, icon: BarChart2 },
                    { label: "Completed", value: velocityQuery.data.completedIssues, icon: CheckCircle2 },
                    { label: "Completion %", value: `${velocityQuery.data.completionRate}%`, icon: Zap },
                    {
                      label: "Daily Rate",
                      value: velocityQuery.data.dailyRate != null ? `${velocityQuery.data.dailyRate}/day` : "—",
                      icon: Clock,
                    },
                  ].map((kpi) => (
                    <div key={kpi.label} className="rounded-lg border p-2 space-y-0.5">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <kpi.icon className="h-3 w-3" />
                        <span className="text-xs">{kpi.label}</span>
                      </div>
                      <p className="text-lg font-bold">{kpi.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* AI Report */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">AI Sprint Report</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => generateReport.mutate()}
                    disabled={generateReport.isPending}
                  >
                    <RefreshCw className={`h-3 w-3 ${generateReport.isPending ? "animate-spin" : ""}`} />
                    {sprint.aiReport ? "Regenerate" : "Generate"}
                  </Button>
                </div>

                {sprint.aiReport ? (
                  <div className="space-y-2 text-xs">
                    <p className="text-muted-foreground">{sprint.aiReport.summary}</p>
                    {sprint.aiReport.topAccomplishments.length > 0 && (
                      <div>
                        <p className="font-medium text-green-700 dark:text-green-400 mb-0.5 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Accomplishments
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {sprint.aiReport.topAccomplishments.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {sprint.aiReport.risks.length > 0 && (
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400 mb-0.5 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Risks
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {sprint.aiReport.risks.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {sprint.aiReport.recommendations.length > 0 && (
                      <div>
                        <p className="font-medium text-blue-700 dark:text-blue-400 mb-0.5 flex items-center gap-1">
                          <Zap className="h-3 w-3" /> Recommendations
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                          {sprint.aiReport.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Generated {new Date(sprint.aiReport.generatedAt).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No AI report yet. Click "Generate" to create one using Ollama.
                  </p>
                )}
              </div>
            </div>
          )}

          {tab === "issues" && (
            <SprintIssuesTab sprint={sprint} companyId={companyId} projects={projects} />
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface CreateSprintForm {
  name: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string;
  projectId: string;
}

export function Sprints() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CreateSprintForm>({
    name: "",
    goal: "",
    status: "planning",
    startDate: "",
    endDate: "",
    projectId: "__none__",
  });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Sprints" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const sprintsQuery = useQuery({
    queryKey: queryKeys.sprints.list(selectedCompanyId!),
    queryFn: () => sprintApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projectsQuery = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const projects = (projectsQuery.data ?? []) as Project[];

  const createSprint = useMutation({
    mutationFn: (data: CreateSprintForm) =>
      sprintApi.create(selectedCompanyId!, {
        name: data.name,
        goal: data.goal || null,
        status: data.status,
        projectId: data.projectId !== "__none__" ? data.projectId : null,
        startDate: data.startDate ? new Date(data.startDate).toISOString() : null,
        endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(selectedCompanyId!) });
      setShowCreate(false);
      setForm({ name: "", goal: "", status: "planning", startDate: "", endDate: "", projectId: "__none__" });
    },
  });

  const deleteSprint = useMutation({
    mutationFn: (id: string) => sprintApi.delete(selectedCompanyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sprints.list(selectedCompanyId!) });
    },
  });

  if (sprintsQuery.isLoading) return <PageSkeleton />;

  const sprints = sprintsQuery.data?.sprints ?? [];
  const activeSprints = sprints.filter((s) => s.status === "active");
  const planningSprints = sprints.filter((s) => s.status === "planning");
  const completedSprints = sprints.filter((s) => s.status === "completed");

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sprints</h1>
          <p className="text-sm text-muted-foreground">Manage sprints, track velocity, and generate AI reports</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> New Sprint
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active", value: activeSprints.length, icon: Zap, color: "text-green-600" },
          { label: "Planning", value: planningSprints.length, icon: Clock, color: "text-blue-600" },
          { label: "Completed", value: completedSprints.length, icon: CheckCircle2, color: "text-muted-foreground" },
        ].map((kpi) => (
          <Card key={kpi.label} className="p-4 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs">{kpi.label}</span>
              <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Sprint list */}
      {sprints.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No sprints yet. Create one to get started.</p>
          <Button size="sm" className="mt-4 gap-1" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5" /> New Sprint
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {activeSprints.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active</h2>
              {activeSprints.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  companyId={selectedCompanyId!}
                  projects={projects}
                  onDelete={() => deleteSprint.mutate(s.id)}
                />
              ))}
            </div>
          )}
          {planningSprints.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Planning</h2>
              {planningSprints.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  companyId={selectedCompanyId!}
                  projects={projects}
                  onDelete={() => deleteSprint.mutate(s.id)}
                />
              ))}
            </div>
          )}
          {completedSprints.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Completed</h2>
              {completedSprints.map((s) => (
                <SprintCard
                  key={s.id}
                  sprint={s}
                  companyId={selectedCompanyId!}
                  projects={projects}
                  onDelete={() => deleteSprint.mutate(s.id)}
                />
              ))}
            </div>
          )}
          {sprints.filter((s) => s.status === "cancelled").map((s) => (
            <SprintCard
              key={s.id}
              sprint={s}
              companyId={selectedCompanyId!}
              projects={projects}
              onDelete={() => deleteSprint.mutate(s.id)}
            />
          ))}
        </div>
      )}

      {/* Create sprint dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Sprint</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Sprint Name *</Label>
              <Input
                className="mt-1"
                placeholder="Sprint 1, Q2 Sprint 3, …"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Sprint Goal</Label>
              <Textarea
                className="mt-1 resize-none"
                rows={2}
                placeholder="What is the goal of this sprint?"
                value={form.goal}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Project</Label>
              <Select
                value={form.projectId}
                onValueChange={(v) => setForm((f) => ({ ...f, projectId: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No project</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => createSprint.mutate(form)}
                disabled={!form.name.trim() || createSprint.isPending}
              >
                {createSprint.isPending ? "Creating…" : "Create Sprint"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
