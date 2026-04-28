import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { researchApi, type ResearchLiterature as ResearchLiteratureType } from "../api/research";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { useToast } from "../context/ToastContext";
import { BookOpen, Plus, Pencil, Trash2, Check, X, ExternalLink } from "lucide-react";

type FormState = {
  title: string;
  authors: string;
  year: string;
  url: string;
  notes: string;
};

const emptyForm = (): FormState => ({ title: "", authors: "", year: "", url: "", notes: "" });

export function ResearchLiterature() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();
  const { pushToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Research" },
      { label: "Literature" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.research.literature(selectedCompanyId!),
    queryFn: () => researchApi.listLiterature(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const entries = data?.literature ?? [];

  const createMutation = useMutation({
    mutationFn: (d: FormState) =>
      researchApi.createLiterature(selectedCompanyId!, {
        title: d.title,
        authors: d.authors || null,
        year: d.year || null,
        url: d.url || null,
        notes: d.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.research.literature(selectedCompanyId!) });
      setForm(emptyForm());
      setShowForm(false);
      pushToast({ title: "Entry added", tone: "success" });
    },
    onError: (e: Error) => pushToast({ title: e.message, tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FormState }) =>
      researchApi.updateLiterature(selectedCompanyId!, id, {
        title: data.title,
        authors: data.authors || null,
        year: data.year || null,
        url: data.url || null,
        notes: data.notes || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.research.literature(selectedCompanyId!) });
      setEditingId(null);
      pushToast({ title: "Entry updated", tone: "success" });
    },
    onError: (e: Error) => pushToast({ title: e.message, tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => researchApi.deleteLiterature(selectedCompanyId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.research.literature(selectedCompanyId!) });
      pushToast({ title: "Entry deleted", tone: "success" });
    },
    onError: (e: Error) => pushToast({ title: e.message, tone: "error" }),
  });

  function startEdit(entry: ResearchLiteratureType) {
    setEditingId(entry.id);
    setEditForm({
      title: entry.title,
      authors: entry.authors ?? "",
      year: entry.year ?? "",
      url: entry.url ?? "",
      notes: entry.notes ?? "",
    });
  }

  function LitForm({
    value,
    onChange,
    onSave,
    onCancel,
    saving,
  }: {
    value: FormState;
    onChange: (v: FormState) => void;
    onSave: () => void;
    onCancel: () => void;
    saving: boolean;
  }) {
    return (
      <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
        <Input
          placeholder="Title *"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            placeholder="Authors"
            value={value.authors}
            onChange={(e) => onChange({ ...value, authors: e.target.value })}
          />
          <Input
            placeholder="Year"
            value={value.year}
            onChange={(e) => onChange({ ...value, year: e.target.value })}
          />
        </div>
        <Input
          placeholder="URL / DOI"
          value={value.url}
          onChange={(e) => onChange({ ...value, url: e.target.value })}
        />
        <Textarea
          placeholder="Notes"
          value={value.notes}
          onChange={(e) => onChange({ ...value, notes: e.target.value })}
          rows={3}
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={!value.title.trim() || saving} onClick={onSave}>
            <Check className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            <X className="h-3.5 w-3.5 mr-1" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (!selectedCompanyId) return <EmptyState icon={BookOpen} message="Select a company." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Literature</h1>
          <p className="text-sm text-muted-foreground">
            {entries.length} entr{entries.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Entry
        </Button>
      </div>

      {showForm && (
        <LitForm
          value={form}
          onChange={setForm}
          onSave={() => createMutation.mutate(form)}
          onCancel={() => { setShowForm(false); setForm(emptyForm()); }}
          saving={createMutation.isPending}
        />
      )}

      {entries.length === 0 && !showForm && (
        <EmptyState
          icon={BookOpen}
          message="No literature entries yet."
          action="Add Entry"
          onAction={() => setShowForm(true)}
        />
      )}

      <div className="space-y-3">
        {entries.map((entry) =>
          editingId === entry.id ? (
            <LitForm
              key={entry.id}
              value={editForm}
              onChange={setEditForm}
              onSave={() => updateMutation.mutate({ id: entry.id, data: editForm })}
              onCancel={() => setEditingId(null)}
              saving={updateMutation.isPending}
            />
          ) : (
            <div key={entry.id} className="border border-border rounded-lg p-4 bg-card group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{entry.title}</p>
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {(entry.authors || entry.year) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[entry.authors, entry.year].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  {entry.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{entry.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(entry)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMutation.mutate(entry.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
