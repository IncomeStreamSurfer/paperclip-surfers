import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Plus, Trash2, Loader2, X } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { seoApi } from "../api/seo";
import { queryKeys } from "../lib/queryKeys";
import type { SeoPage } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "needs-work": "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
};

function AddPageDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [h1, setH1] = useState("");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [seoScore, setSeoScore] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "needs-work">("draft");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof seoApi.createPage>[1]) =>
      seoApi.createPage(companyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.pages(companyId) });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    createMutation.mutate({
      url: url.trim(),
      title: title.trim() || null,
      metaDescription: metaDescription.trim() || null,
      h1: h1.trim() || null,
      focusKeyword: focusKeyword.trim() || null,
      seoScore: seoScore ? parseInt(seoScore, 10) : null,
      status,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Add SEO Page</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL *</label>
            <Input
              autoFocus
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Page Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Best Project Management Software 2025"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Meta Description</label>
            <Input
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder="150–160 character summary"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">H1</label>
              <Input
                value={h1}
                onChange={(e) => setH1(e.target.value)}
                placeholder="Main heading"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Focus Keyword</label>
              <Input
                value={focusKeyword}
                onChange={(e) => setFocusKeyword(e.target.value)}
                placeholder="e.g. project management"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SEO Score (0–100)</label>
              <Input
                type="number"
                value={seoScore}
                onChange={(e) => setSeoScore(e.target.value)}
                placeholder="e.g. 78"
                min={0}
                max={100}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="needs-work">Needs Work</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
              className="mt-1"
            />
          </div>
          {createMutation.error && (
            <p className="text-xs text-destructive">{String(createMutation.error)}</p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={!url.trim() || createMutation.isPending} className="flex-1">
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Add Page
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function SeoPages() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO", href: "/seo" }, { label: "Pages" }]);
  }, [setBreadcrumbs]);

  const { data: pages = [], isLoading } = useQuery({
    queryKey: queryKeys.seo.pages(selectedCompanyId!, filterStatus ? { status: filterStatus } : undefined),
    queryFn: () => seoApi.listPages(selectedCompanyId!, filterStatus ? { status: filterStatus } : undefined),
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => seoApi.deletePage(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.seo.pages(selectedCompanyId!) }),
  });

  if (!selectedCompanyId) return null;

  return (
    <div className="space-y-4 max-w-5xl">
      {showAdd && (
        <AddPageDialog companyId={selectedCompanyId} onClose={() => setShowAdd(false)} />
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">SEO Pages</h1>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 py-0 text-sm"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="needs-work">Needs Work</option>
          </select>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Page
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No SEO pages tracked yet.</p>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Page
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">URL</th>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Focus Keyword</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pages.map((page: SeoPage) => (
                <tr key={page.id} className="hover:bg-accent/20">
                  <td className="px-4 py-2 font-mono text-xs truncate max-w-[220px]">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline text-primary"
                    >
                      {page.url.replace(/^https?:\/\/[^/]+/, "") || "/"}
                    </a>
                  </td>
                  <td className="px-4 py-2 truncate max-w-[200px]">{page.title ?? "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{page.focusKeyword ?? "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {page.seoScore != null ? (
                      <span
                        className={
                          page.seoScore >= 80
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : page.seoScore >= 50
                            ? "text-yellow-600 dark:text-yellow-400 font-medium"
                            : "text-destructive font-medium"
                        }
                      >
                        {page.seoScore}/100
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[page.status] ?? STATUS_BADGE.draft}`}
                    >
                      {page.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(page.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
