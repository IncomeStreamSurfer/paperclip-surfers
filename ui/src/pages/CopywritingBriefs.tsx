import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  PenLine,
  Plus,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { copywritingApi } from "../api/copywriting";
import { queryKeys } from "../lib/queryKeys";
import {
  COPYWRITING_CONTENT_TYPES,
  COPYWRITING_BRIEF_STATUSES,
} from "@paperclipai/shared";
import type { CopywritingBrief } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CONTENT_TYPE_LABELS: Record<string, string> = {
  "blog-post": "Blog Post",
  article: "Article",
  "social-post": "Social Post",
  email: "Email",
  "landing-page": "Landing Page",
  "product-description": "Product Description",
  "press-release": "Press Release",
  whitepaper: "Whitepaper",
  "case-study": "Case Study",
  newsletter: "Newsletter",
  "ad-copy": "Ad Copy",
  other: "Other",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  "in-progress": "In Progress",
  review: "Review",
  approved: "Approved",
  published: "Published",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground",
  "in-progress": "text-blue-600 dark:text-blue-400",
  review: "text-yellow-600 dark:text-yellow-400",
  approved: "text-emerald-600 dark:text-emerald-400",
  published: "text-emerald-700 dark:text-emerald-300 font-semibold",
};

function AddBriefDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<string>("blog-post");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [wordCountTarget, setWordCountTarget] = useState("");
  const [brief, setBrief] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof copywritingApi.createBrief>[1]) =>
      copywritingApi.createBrief(companyId, data),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: queryKeys.copywriting.briefs(companyId),
      });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createMutation.mutate({
      title: title.trim(),
      contentType,
      targetKeyword: targetKeyword.trim() || null,
      targetAudience: targetAudience.trim() || null,
      wordCountTarget: wordCountTarget ? parseInt(wordCountTarget, 10) : null,
      brief: brief.trim() || null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">New Brief</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Title *
            </label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 10 Tips for Better Copywriting"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Content Type
            </label>
            <select
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            >
              {COPYWRITING_CONTENT_TYPES.map((ct) => (
                <option key={ct} value={ct}>
                  {CONTENT_TYPE_LABELS[ct] ?? ct}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Target Keyword
            </label>
            <Input
              value={targetKeyword}
              onChange={(e) => setTargetKeyword(e.target.value)}
              placeholder="e.g. email marketing tips"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Target Audience
            </label>
            <Input
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              placeholder="e.g. SaaS founders, B2B marketers"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Word Count Target
            </label>
            <Input
              type="number"
              value={wordCountTarget}
              onChange={(e) => setWordCountTarget(e.target.value)}
              placeholder="e.g. 1500"
              min={1}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Brief
            </label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe what this piece should cover, tone, structure…"
              rows={4}
              className="mt-1 w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notes
            </label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
              className="mt-1"
            />
          </div>
          {createMutation.error && (
            <p className="text-xs text-destructive">
              {String(createMutation.error)}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={!title.trim() || createMutation.isPending}
              className="flex-1"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : null}
              Create Brief
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CopywritingBriefs() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Copywriting", href: "/copywriting" },
      { label: "Briefs" },
    ]);
  }, [setBreadcrumbs]);

  const { data: briefs = [], isLoading } = useQuery({
    queryKey: queryKeys.copywriting.briefs(selectedCompanyId!, {
      status: filterStatus || undefined,
    }),
    queryFn: () =>
      copywritingApi.listBriefs(selectedCompanyId!, {
        status: filterStatus || undefined,
      }),
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => copywritingApi.deleteBrief(id),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.copywriting.briefs(selectedCompanyId!),
      }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      copywritingApi.updateBrief(id, { status }),
    onSuccess: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.copywriting.briefs(selectedCompanyId!),
      }),
  });

  if (!selectedCompanyId) return null;

  return (
    <div className="space-y-4 max-w-6xl">
      {showAdd && (
        <AddBriefDialog
          companyId={selectedCompanyId}
          onClose={() => setShowAdd(false)}
        />
      )}

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Briefs</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All statuses</option>
            {COPYWRITING_BRIEF_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Brief
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : briefs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <PenLine className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">
            {filterStatus
              ? `No briefs with status "${STATUS_LABELS[filterStatus] ?? filterStatus}".`
              : "No briefs yet. Create your first content brief."}
          </p>
          {!filterStatus && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> New Brief
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Title</th>
                <th className="px-4 py-2 text-left font-medium">Type</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Keyword</th>
                <th className="px-4 py-2 text-right font-medium">Words</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {briefs.map((b: CopywritingBrief) => (
                <tr key={b.id} className="hover:bg-accent/20">
                  <td className="px-4 py-2 font-medium max-w-[260px] truncate">
                    <Link
                      to={`briefs/${b.id}`}
                      className="hover:underline hover:text-primary"
                    >
                      {b.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                    {CONTENT_TYPE_LABELS[b.contentType] ?? b.contentType}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <select
                      value={b.status}
                      onChange={(e) =>
                        updateStatusMutation.mutate({
                          id: b.id,
                          status: e.target.value,
                        })
                      }
                      className={`bg-transparent border-none outline-none text-sm cursor-pointer ${STATUS_COLORS[b.status] ?? ""}`}
                    >
                      {COPYWRITING_BRIEF_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s] ?? s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground truncate max-w-[160px]">
                    {b.targetKeyword ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                    {b.wordCountTarget != null
                      ? b.wordCountTarget.toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(b.id)}
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
