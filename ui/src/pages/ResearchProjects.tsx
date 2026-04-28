import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { researchApi, type ResearchProject } from "../api/research";
import { queryKeys } from "../lib/queryKeys";
import { FlaskConical, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";

const STATUSES = ["active", "completed", "paused", "archived"] as const;
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  archived: "bg-muted text-muted-foreground",
};

function ProjectRow({
  project,
  companyId,
}: {
  project: ResearchProject;
  companyId: string;
}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [domain, setDomain] = useState(project.domain ?? "");
  const [status, setStatus] = useState(project.status);
  const [abstract, setAbstract] = useState(project.abstract ?? "");

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.research.projects(companyId) });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof researchApi.updateProject>[2]) =>
      researchApi.updateProject(companyId, project.id, data),
    onSuccess: () => { invalidate(); setEditing(false); },
    onError: () => pushToast({ title: "Failed to update project", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => researchApi.deleteProject(companyId, project.id),
    onSuccess: invalidate,
    onError: () => pushToast({ title: "Failed to delete project", tone: "error" }),
  });

  if (editing) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full text-sm font-medium px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Project title"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Domain (e.g. NLP, Biology)"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <textarea
          value={abstract}
          onChange={(e) => setAbstract(e.target.value)}
          rows={3}
          className="w-full text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          placeholder="Abstract (optional)"
        />
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setEditing(false); setTitle(project.title); setDomain(project.domain ?? ""); setStatus(project.status); setAbstract(project.abstract ?? ""); }}
          >
            <X className="w-3.5 h-3.5 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={!title.trim() || updateMutation.isPending}
            onClick={() => updateMutation.mutate({ title: title.trim(), domain: domain.trim() || null, status, abstract: abstract.trim() || null })}
          >
            <Check className="w-3.5 h-3.5 mr-1" /> Save
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-border/80">
      <FlaskConical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm font-medium">{project.title}</p>
          <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLORS[project.status] ?? "bg-muted text-muted-foreground"}`}>
            {project.status}
          </span>
        </div>
        {project.domain && <p className="text-xs text-muted-foreground mt-0.5">{project.domain}</p>}
        {project.abstract && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.abstract}</p>}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          className="p-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setEditing(true)}
          aria-label="Edit"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
          onClick={() => { if (confirm(`Delete "${project.title}"?`)) deleteMutation.mutate(); }}
          aria-label="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ResearchProjects() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newStatus, setNewStatus] = useState<string>("active");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Research", href: "/research" },
      { label: "Projects" },
    ]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.research.projects(selectedCompanyId!),
    queryFn: () => researchApi.listProjects(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      researchApi.createProject(selectedCompanyId!, {
        title: newTitle.trim(),
        domain: newDomain.trim() || null,
        status: newStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.research.projects(selectedCompanyId!) });
      setNewTitle("");
      setNewDomain("");
      setNewStatus("active");
      setShowCreate(false);
    },
    onError: () => pushToast({ title: "Failed to create project", tone: "error" }),
  });

  if (!selectedCompanyId) return null;
  if (isLoading) return <PageSkeleton variant="list" />;

  const projects = data?.projects ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Research Projects</h2>
          <p className="text-sm text-muted-foreground">{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" /> New Project
        </Button>
      </div>

      {showCreate && (
        <form
          className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card"
          onSubmit={(e) => { e.preventDefault(); if (!newTitle.trim()) return; createMutation.mutate(); }}
        >
          <h3 className="text-sm font-medium">New Research Project</h3>
          <input
            type="text"
            placeholder="Title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Domain (optional)"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="text-sm px-3 py-1.5 border border-border rounded bg-background focus:outline-none"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={!newTitle.trim() || createMutation.isPending}>
              Create
            </Button>
          </div>
        </form>
      )}

      {projects.length === 0 && !showCreate ? (
        <EmptyState icon={FlaskConical} message="No research projects yet. Create one to get started." />
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} project={p} companyId={selectedCompanyId} />
          ))}
        </div>
      )}
    </div>
  );
}
