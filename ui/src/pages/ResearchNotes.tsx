import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { researchApi, type ResearchNote } from "../api/research";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { useToast } from "../context/ToastContext";
import { StickyNote, Plus, Pencil, Trash2, Check, X } from "lucide-react";

type EditState = { content: string; tags: string };

export function ResearchNotes() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();
  const { pushToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newTags, setNewTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState>({ content: "", tags: "" });

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Research" },
      { label: "Notes" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.research.notes(selectedCompanyId!),
    queryFn: () => researchApi.listNotes(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const notes = data?.notes ?? [];

  const createMutation = useMutation({
    mutationFn: (d: { content: string; tags: string | null }) =>
      researchApi.createNote(selectedCompanyId!, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.research.notes(selectedCompanyId!) });
      setNewContent("");
      setNewTags("");
      setShowForm(false);
      pushToast({ title: "Note added", tone: "success" });
    },
    onError: (e: Error) => pushToast({ title: e.message, tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content: string; tags: string | null } }) =>
      researchApi.updateNote(selectedCompanyId!, id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.research.notes(selectedCompanyId!) });
      setEditingId(null);
      pushToast({ title: "Note updated", tone: "success" });
    },
    onError: (e: Error) => pushToast({ title: e.message, tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => researchApi.deleteNote(selectedCompanyId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.research.notes(selectedCompanyId!) });
      pushToast({ title: "Note deleted", tone: "success" });
    },
    onError: (e: Error) => pushToast({ title: e.message, tone: "error" }),
  });

  function startEdit(note: ResearchNote) {
    setEditingId(note.id);
    setEditState({ content: note.content, tags: note.tags ?? "" });
  }

  if (!selectedCompanyId) return <EmptyState icon={StickyNote} message="Select a company." />;
  if (isLoading) return <PageSkeleton variant="list" />;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Research Notes</h1>
          <p className="text-sm text-muted-foreground">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" />
          Add Note
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-card">
          <Textarea
            placeholder="Note content…"
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            rows={4}
          />
          <Input
            placeholder="Tags (comma-separated)"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!newContent.trim() || createMutation.isPending}
              onClick={() =>
                createMutation.mutate({ content: newContent.trim(), tags: newTags.trim() || null })
              }
            >
              Save Note
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 && !showForm && (
        <EmptyState
          icon={StickyNote}
          message="No notes yet."
          action="Add Note"
          onAction={() => setShowForm(true)}
        />
      )}

      <div className="space-y-3">
        {notes.map((note) =>
          editingId === note.id ? (
            <div key={note.id} className="border border-primary rounded-lg p-4 space-y-3 bg-card">
              <Textarea
                value={editState.content}
                onChange={(e) => setEditState((s) => ({ ...s, content: e.target.value }))}
                rows={4}
              />
              <Input
                placeholder="Tags"
                value={editState.tags}
                onChange={(e) => setEditState((s) => ({ ...s, tags: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!editState.content.trim() || updateMutation.isPending}
                  onClick={() =>
                    updateMutation.mutate({
                      id: note.id,
                      data: { content: editState.content.trim(), tags: editState.tags.trim() || null },
                    })
                  }
                >
                  <Check className="h-3.5 w-3.5 mr-1" /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div key={note.id} className="border border-border rounded-lg p-4 bg-card group">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm whitespace-pre-wrap flex-1">{note.content}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(note)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => deleteMutation.mutate(note.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              {note.tags && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {note.tags.split(",").map((t) => t.trim()).filter(Boolean).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {new Date(note.createdAt).toLocaleDateString()}
              </p>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
