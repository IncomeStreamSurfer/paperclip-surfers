import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { civilApi, type CivilSpecification, type CivilProject } from "../api/civil";
import { queryKeys } from "../lib/queryKeys";
import { FileText, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SPEC_STATUSES = ["draft", "issued", "superseded"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  superseded: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type SpecForm = {
  title: string;
  projectId: string;
  sectionNumber: string;
  status: string;
  content: string;
};

const emptyForm = (projectId?: string): SpecForm => ({
  title: "",
  projectId: projectId ?? "",
  sectionNumber: "",
  status: "draft",
  content: "",
});

function SpecDialog({
  open,
  onClose,
  initial,
  companyId,
  editId,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  initial?: SpecForm;
  companyId: string;
  editId?: string;
  projects: CivilProject[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SpecForm>(initial ?? emptyForm());

  useEffect(() => {
    setForm(initial ?? emptyForm());
  }, [initial, open]);

  const upsert = useMutation({
    mutationFn: () => {
      const data = {
        title: form.title,
        projectId: form.projectId || null,
        sectionNumber: form.sectionNumber || null,
        status: form.status,
        content: form.content || null,
      };
      if (editId) return civilApi.updateSpec(companyId, editId, data);
      return civilApi.createSpec(companyId, { ...data, title: form.title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.civil.specs(companyId) });
      onClose();
    },
  });

  const f = (k: keyof SpecForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Specification" : "New Specification"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input className="mt-1" placeholder="Concrete Work" value={form.title} onChange={f("title")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Section Number</Label>
              <Input className="mt-1" placeholder="03300" value={form.sectionNumber} onChange={f("sectionNumber")} />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPEC_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {projects.length > 0 && (
            <div>
              <Label className="text-xs">Project</Label>
              <Select
                value={form.projectId || "__none__"}
                onValueChange={(v) => setForm((p) => ({ ...p, projectId: v === "__none__" ? "" : v }))}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Content</Label>
            <Textarea
              className="mt-1 resize-none"
              rows={5}
              placeholder="Specification text / requirements…"
              value={form.content}
              onChange={f("content")}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={() => upsert.mutate()}
              disabled={!form.title.trim() || upsert.isPending}
            >
              {upsert.isPending ? "Saving…" : editId ? "Save" : "Add Specification"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CivilSpecs() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CivilSpecification | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Civil / Architecture" },
      { label: "Specifications" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const specsQuery = useQuery({
    queryKey: queryKeys.civil.specs(selectedCompanyId!),
    queryFn: () => civilApi.listSpecs(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.civil.projects(selectedCompanyId!),
    queryFn: () => civilApi.listProjects(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteSpec = useMutation({
    mutationFn: (id: string) => civilApi.deleteSpec(selectedCompanyId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.civil.specs(selectedCompanyId!) }),
  });

  if (specsQuery.isLoading) return <PageSkeleton />;

  const specs = specsQuery.data?.specs ?? [];
  const projects = projectsQuery.data?.projects ?? [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Specifications</h1>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Specification
        </Button>
      </div>

      {specs.length === 0 ? (
        <EmptyState
          icon={FileText}
          message="No specifications. Add project specifications to track requirements, standards and scope."
          action="Add Specification"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="space-y-1.5">
          {specs.map((s) => (
            <div key={s.id} className="rounded-lg border border-border bg-card px-4 py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {s.sectionNumber && (
                    <span className="font-mono text-xs text-muted-foreground">{s.sectionNumber}</span>
                  )}
                  <span className="font-medium text-sm">{s.title}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[s.status] ?? ""}`}>
                    {s.status}
                  </span>
                </div>
                {(s.projectId || s.content) && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                    {[
                      s.projectId ? projectMap[s.projectId] : null,
                      s.content,
                    ].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(s)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteSpec.mutate(s.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SpecDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        companyId={selectedCompanyId!}
        projects={projects}
      />
      {editing && (
        <SpecDialog
          open
          onClose={() => setEditing(null)}
          companyId={selectedCompanyId!}
          editId={editing.id}
          projects={projects}
          initial={{
            title: editing.title,
            projectId: editing.projectId ?? "",
            sectionNumber: editing.sectionNumber ?? "",
            status: editing.status,
            content: editing.content ?? "",
          }}
        />
      )}
    </div>
  );
}
