import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { civilApi, type CivilProject } from "../api/civil";
import { queryKeys } from "../lib/queryKeys";
import { HardHat, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PROJECT_TYPES = ["general", "residential", "commercial", "infrastructure", "industrial", "landscape"] as const;
const PROJECT_STATUSES = ["planning", "design", "approval", "construction", "complete", "on_hold"] as const;

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  design: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  approval: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  construction: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  complete: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  on_hold: "bg-muted text-muted-foreground",
};

type ProjectForm = {
  name: string;
  description: string;
  projectType: string;
  status: string;
  location: string;
  clientName: string;
  estimatedBudget: string;
  startDate: string;
  endDate: string;
};

const empty: ProjectForm = {
  name: "",
  description: "",
  projectType: "general",
  status: "planning",
  location: "",
  clientName: "",
  estimatedBudget: "",
  startDate: "",
  endDate: "",
};

function ProjectDialog({
  open,
  onClose,
  initial,
  companyId,
  editId,
}: {
  open: boolean;
  onClose: () => void;
  initial?: ProjectForm;
  companyId: string;
  editId?: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProjectForm>(initial ?? empty);

  useEffect(() => {
    setForm(initial ?? empty);
  }, [initial, open]);

  const upsert = useMutation({
    mutationFn: () => {
      const data = {
        name: form.name,
        description: form.description || null,
        projectType: form.projectType,
        status: form.status,
        location: form.location || null,
        clientName: form.clientName || null,
        estimatedBudget: form.estimatedBudget || null,
        startDate: form.startDate ? new Date(form.startDate).toISOString() : null,
        endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
      };
      if (editId) return civilApi.updateProject(companyId, editId, data);
      return civilApi.createProject(companyId, { ...data, name: form.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.civil.projects(companyId) });
      onClose();
    },
  });

  const f = (k: keyof ProjectForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Project" : "New Civil Project"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Project Name *</Label>
            <Input className="mt-1" placeholder="Bridge Rd Overpass" value={form.name} onChange={f("name")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.projectType} onValueChange={(v) => setForm((p) => ({ ...p, projectType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Location</Label>
            <Input className="mt-1" placeholder="123 Main St, Springfield" value={form.location} onChange={f("location")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Client Name</Label>
              <Input className="mt-1" placeholder="City of Springfield" value={form.clientName} onChange={f("clientName")} />
            </div>
            <div>
              <Label className="text-xs">Estimated Budget</Label>
              <Input className="mt-1" placeholder="$2,500,000" value={form.estimatedBudget} onChange={f("estimatedBudget")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Start Date</Label>
              <Input type="date" className="mt-1" value={form.startDate} onChange={f("startDate")} />
            </div>
            <div>
              <Label className="text-xs">End Date</Label>
              <Input type="date" className="mt-1" value={form.endDate} onChange={f("endDate")} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea className="mt-1 resize-none" rows={2} value={form.description} onChange={f("description")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => upsert.mutate()} disabled={!form.name.trim() || upsert.isPending}>
              {upsert.isPending ? "Saving…" : editId ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CivilProjects() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CivilProject | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Civil / Architecture" },
      { label: "Projects" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const query = useQuery({
    queryKey: queryKeys.civil.projects(selectedCompanyId!),
    queryFn: () => civilApi.listProjects(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => civilApi.deleteProject(selectedCompanyId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.civil.projects(selectedCompanyId!) }),
  });

  if (query.isLoading) return <PageSkeleton />;
  const projects = query.data?.projects ?? [];

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Civil Projects</h1>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> New Project
        </Button>
      </div>

      {projects.length === 0 ? (
        <EmptyState
           icon={HardHat}
           message="No civil projects. Create your first project to get started."
           action="New Project"
           onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{p.name}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[p.status] ?? ""}`}>
                    {p.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground capitalize">{p.projectType}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[p.location, p.clientName, p.estimatedBudget].filter(Boolean).join(" · ")}
                </p>
                {p.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteProject.mutate(p.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        companyId={selectedCompanyId!}
      />
      {editing && (
        <ProjectDialog
          open
          onClose={() => setEditing(null)}
          companyId={selectedCompanyId!}
          editId={editing.id}
          initial={{
            name: editing.name,
            description: editing.description ?? "",
            projectType: editing.projectType,
            status: editing.status,
            location: editing.location ?? "",
            clientName: editing.clientName ?? "",
            estimatedBudget: editing.estimatedBudget ?? "",
            startDate: editing.startDate ? editing.startDate.split("T")[0] : "",
            endDate: editing.endDate ? editing.endDate.split("T")[0] : "",
          }}
        />
      )}
    </div>
  );
}
