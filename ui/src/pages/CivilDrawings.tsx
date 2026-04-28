import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { civilApi, type CivilDrawing, type CivilProject } from "../api/civil";
import { queryKeys } from "../lib/queryKeys";
import { Ruler, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DRAWING_TYPES = ["plan", "elevation", "section", "detail", "site", "structural", "mep", "landscape"] as const;
const DRAWING_STATUSES = ["draft", "in_review", "approved", "superseded"] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  superseded: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

type DrawingForm = {
  title: string;
  projectId: string;
  drawingNumber: string;
  drawingType: string;
  status: string;
  revision: string;
  discipline: string;
  scale: string;
  fileUrl: string;
  notes: string;
};

const emptyForm = (projectId?: string): DrawingForm => ({
  title: "",
  projectId: projectId ?? "",
  drawingNumber: "",
  drawingType: "plan",
  status: "draft",
  revision: "A",
  discipline: "",
  scale: "1:100",
  fileUrl: "",
  notes: "",
});

function DrawingDialog({
  open,
  onClose,
  initial,
  companyId,
  editId,
  projects,
}: {
  open: boolean;
  onClose: () => void;
  initial?: DrawingForm;
  companyId: string;
  editId?: string;
  projects: CivilProject[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<DrawingForm>(initial ?? emptyForm());

  useEffect(() => {
    setForm(initial ?? emptyForm());
  }, [initial, open]);

  const upsert = useMutation({
    mutationFn: () => {
      const data = {
        title: form.title,
        projectId: form.projectId || null,
        drawingNumber: form.drawingNumber || null,
        drawingType: form.drawingType,
        status: form.status,
        revision: form.revision || "A",
        discipline: form.discipline || null,
        scale: form.scale || null,
        fileUrl: form.fileUrl || null,
        notes: form.notes || null,
      };
      if (editId) return civilApi.updateDrawing(companyId, editId, data);
      return civilApi.createDrawing(companyId, { ...data, title: form.title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.civil.drawings(companyId) });
      onClose();
    },
  });

  const f = (k: keyof DrawingForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editId ? "Edit Drawing" : "New Drawing"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Title *</Label>
            <Input className="mt-1" placeholder="Ground Floor Plan" value={form.title} onChange={f("title")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Drawing Number</Label>
              <Input className="mt-1" placeholder="A-001" value={form.drawingNumber} onChange={f("drawingNumber")} />
            </div>
            <div>
              <Label className="text-xs">Revision</Label>
              <Input className="mt-1" placeholder="A" value={form.revision} onChange={f("revision")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.drawingType} onValueChange={(v) => setForm((p) => ({ ...p, drawingType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DRAWING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{DRAWING_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Discipline</Label>
              <Input className="mt-1" placeholder="Architecture, Structural…" value={form.discipline} onChange={f("discipline")} />
            </div>
            <div>
              <Label className="text-xs">Scale</Label>
              <Input className="mt-1" placeholder="1:100" value={form.scale} onChange={f("scale")} />
            </div>
          </div>
          {projects.length > 0 && (
            <div>
              <Label className="text-xs">Project</Label>
              <Select value={form.projectId || "__none__"} onValueChange={(v) => setForm((p) => ({ ...p, projectId: v === "__none__" ? "" : v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea className="mt-1 resize-none" rows={2} value={form.notes} onChange={f("notes")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => upsert.mutate()} disabled={!form.title.trim() || upsert.isPending}>
              {upsert.isPending ? "Saving…" : editId ? "Save" : "Add Drawing"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CivilDrawings() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<CivilDrawing | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Civil / Architecture" },
      { label: "Drawing Register" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const drawingsQuery = useQuery({
    queryKey: queryKeys.civil.drawings(selectedCompanyId!),
    queryFn: () => civilApi.listDrawings(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });
  const projectsQuery = useQuery({
    queryKey: queryKeys.civil.projects(selectedCompanyId!),
    queryFn: () => civilApi.listProjects(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteDrawing = useMutation({
    mutationFn: (id: string) => civilApi.deleteDrawing(selectedCompanyId!, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.civil.drawings(selectedCompanyId!) }),
  });

  if (drawingsQuery.isLoading) return <PageSkeleton />;

  const drawings = drawingsQuery.data?.drawings ?? [];
  const projects = projectsQuery.data?.projects ?? [];
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Drawing Register</h1>
        <Button size="sm" className="gap-1" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5" /> Add Drawing
        </Button>
      </div>

      {drawings.length === 0 ? (
        <EmptyState
          icon={Ruler}
          message="No drawings. Add drawings to the register to track revisions and approval status."
          action="Add Drawing"
          onAction={() => setShowCreate(true)}
        />
      ) : (
        <div className="space-y-1.5">
          {drawings.map((d) => (
            <div key={d.id} className="rounded-lg border border-border bg-card px-4 py-2.5 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {d.drawingNumber && (
                    <span className="font-mono text-xs text-muted-foreground">{d.drawingNumber}</span>
                  )}
                  <span className="font-medium text-sm">{d.title}</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${STATUS_COLORS[d.status] ?? ""}`}>
                    {d.status.replace("_", " ")}
                  </span>
                  <span className="text-xs text-muted-foreground">Rev. {d.revision}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {[
                    d.drawingType,
                    d.discipline,
                    d.scale,
                    d.projectId ? projectMap[d.projectId] : null,
                  ].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(d)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => deleteDrawing.mutate(d.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DrawingDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        companyId={selectedCompanyId!}
        projects={projects}
      />
      {editing && (
        <DrawingDialog
          open
          onClose={() => setEditing(null)}
          companyId={selectedCompanyId!}
          editId={editing.id}
          projects={projects}
          initial={{
            title: editing.title,
            projectId: editing.projectId ?? "",
            drawingNumber: editing.drawingNumber ?? "",
            drawingType: editing.drawingType,
            status: editing.status,
            revision: editing.revision,
            discipline: editing.discipline ?? "",
            scale: editing.scale ?? "",
            fileUrl: editing.fileUrl ?? "",
            notes: editing.notes ?? "",
          }}
        />
      )}
    </div>
  );
}
