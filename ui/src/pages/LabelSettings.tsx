import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { issuesApi } from "../api/issues";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Tag, Plus, Pencil, Trash2, Check, X, ArrowLeft } from "lucide-react";
import { Link } from "@/lib/router";
import { useEffect } from "react";
import { ColorPicker } from "@/components/ColorPicker";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pickTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#ec4899", "#f43f5e", "#64748b",
];

// ─── Component ───────────────────────────────────────────────────────────────

export function LabelSettings() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  // New label form state
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("#6366f1");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Settings", href: "/company/settings" },
      { label: "Labels" },
    ]);
  }, [setBreadcrumbs]);

  const { data: labels = [], isLoading } = useQuery({
    queryKey: queryKeys.issues.labels(selectedCompanyId ?? ""),
    queryFn: () => issuesApi.listLabels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const createLabel = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      issuesApi.createLabel(selectedCompanyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.labels(selectedCompanyId!) });
      setNewName("");
      setNewColor("#6366f1");
      pushToast({ tone: "success", title: "Label created" });
    },
    onError: (err: Error) => {
      pushToast({ tone: "error", title: "Failed to create label", body: err.message });
    },
  });

  const updateLabel = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; color?: string } }) =>
      issuesApi.updateLabel(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.labels(selectedCompanyId!) });
      setEditingId(null);
      pushToast({ tone: "success", title: "Label updated" });
    },
    onError: (err: Error) => {
      pushToast({ tone: "error", title: "Failed to update label", body: err.message });
    },
  });

  const deleteLabel = useMutation({
    mutationFn: (id: string) => issuesApi.deleteLabel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.labels(selectedCompanyId!) });
      pushToast({ tone: "success", title: "Label deleted" });
    },
    onError: (err: Error) => {
      pushToast({ tone: "error", title: "Failed to delete label", body: err.message });
    },
  });

  function startEdit(label: { id: string; name: string; color: string }) {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  }

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createLabel.mutate({ name: newName.trim(), color: newColor });
  }

  function submitEdit(id: string) {
    if (!editName.trim()) return;
    updateLabel.mutate({ id, data: { name: editName.trim(), color: editColor } });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to="/company/settings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Labels</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {labels.length} label{labels.length !== 1 ? "s" : ""}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        Labels help categorize and filter issues. They are shared across all projects in this
        company. Deleting a label removes it from all issues.
      </p>

      {/* Label list */}
      <div className="rounded-md border border-border divide-y divide-border">
        {isLoading && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        )}

        {!isLoading && labels.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No labels yet. Create one below.
          </div>
        )}

        {labels.map((label) => (
          <div key={label.id} className="flex items-center gap-3 px-4 py-3">
            {editingId === label.id ? (
              /* ── Edit row ── */
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {/* Color picker */}
                <ColorPicker
                  value={editColor}
                  onChange={setEditColor}
                  className="shrink-0"
                />
                {/* Preset swatches */}
                <div className="hidden sm:flex items-center gap-1 flex-wrap max-w-[200px]">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: c,
                        borderColor: editColor === c ? c : "transparent",
                      }}
                      onClick={() => setEditColor(c)}
                      title={c}
                    />
                  ))}
                </div>
                {/* Name input */}
                <input
                  className="flex-1 min-w-0 px-2 py-1 text-sm bg-transparent outline-none border-b border-primary"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitEdit(label.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                />
                {/* Actions */}
                <button
                  type="button"
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => submitEdit(label.id)}
                  disabled={updateLabel.isPending}
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-accent"
                  onClick={() => setEditingId(null)}
                  title="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* ── Display row ── */
              <>
                {/* Color swatch */}
                <span
                  className="h-4 w-4 rounded-full shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                {/* Pill preview */}
                <span
                  className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    borderColor: label.color,
                    backgroundColor: `${label.color}22`,
                    color: pickTextColor(label.color),
                  }}
                >
                  {label.name}
                </span>
                {/* Hex */}
                <span className="hidden sm:block text-xs text-muted-foreground font-mono ml-1">
                  {label.color}
                </span>

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => startEdit(label)}
                    title={`Edit ${label.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteLabel.mutate(label.id)}
                    disabled={deleteLabel.isPending}
                    title={`Delete ${label.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Create new label */}
      <div className="rounded-md border border-border px-4 py-4 space-y-3">
        <h2 className="text-sm font-medium flex items-center gap-2">
          <Plus className="h-4 w-4" />
          New label
        </h2>
        <form onSubmit={submitCreate} className="space-y-3">
          {/* Preset color swatches */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Color</p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: newColor === c ? "#000" : "transparent",
                    outline: newColor === c ? `2px solid ${c}` : "none",
                    outlineOffset: "1px",
                  }}
                  onClick={() => setNewColor(c)}
                  title={c}
                />
              ))}
              {/* Custom color picker */}
              <ColorPicker value={newColor} onChange={setNewColor} />
              {/* Preview */}
              <span
                className="ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
                style={{
                  borderColor: newColor,
                  backgroundColor: `${newColor}22`,
                  color: pickTextColor(newColor),
                }}
              >
                {newName || "Preview"}
              </span>
            </div>
          </div>

          {/* Name + submit */}
          <div className="flex items-center gap-2">
            <input
              className="flex-1 px-3 py-2 text-sm rounded-md border border-border bg-transparent outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              placeholder="Label name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={48}
            />
            <Button
              type="submit"
              size="sm"
              disabled={!newName.trim() || createLabel.isPending}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Create
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
