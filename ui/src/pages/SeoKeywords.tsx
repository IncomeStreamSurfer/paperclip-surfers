import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Trash2, Loader2, X } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { seoApi } from "../api/seo";
import { queryKeys } from "../lib/queryKeys";
import type { SeoKeyword } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function AddKeywordDialog({
  companyId,
  onClose,
}: {
  companyId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [searchVolume, setSearchVolume] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [currentRank, setCurrentRank] = useState("");
  const [targetRank, setTargetRank] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof seoApi.createKeyword>[1]) =>
      seoApi.createKeyword(companyId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.seo.keywords(companyId) });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    createMutation.mutate({
      keyword: keyword.trim(),
      targetUrl: targetUrl.trim() || null,
      searchVolume: searchVolume ? parseInt(searchVolume, 10) : null,
      difficulty: difficulty ? parseInt(difficulty, 10) : null,
      currentRank: currentRank ? parseInt(currentRank, 10) : null,
      targetRank: targetRank ? parseInt(targetRank, 10) : null,
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-background border border-border rounded-lg shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Add Keyword</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Keyword *</label>
            <Input
              autoFocus
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g. best project management software"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target URL</label>
            <Input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Search Volume</label>
              <Input
                type="number"
                value={searchVolume}
                onChange={(e) => setSearchVolume(e.target.value)}
                placeholder="e.g. 5000"
                min={0}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Difficulty (0–100)</label>
              <Input
                type="number"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                placeholder="e.g. 45"
                min={0}
                max={100}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Rank</label>
              <Input
                type="number"
                value={currentRank}
                onChange={(e) => setCurrentRank(e.target.value)}
                placeholder="e.g. 12"
                min={1}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Rank</label>
              <Input
                type="number"
                value={targetRank}
                onChange={(e) => setTargetRank(e.target.value)}
                placeholder="e.g. 3"
                min={1}
                className="mt-1"
              />
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
            <Button type="submit" size="sm" disabled={!keyword.trim() || createMutation.isPending} className="flex-1">
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Add Keyword
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

export function SeoKeywords() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "SEO", href: "/seo" }, { label: "Keywords" }]);
  }, [setBreadcrumbs]);

  const { data: keywords = [], isLoading } = useQuery({
    queryKey: queryKeys.seo.keywords(selectedCompanyId!),
    queryFn: () => seoApi.listKeywords(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => seoApi.deleteKeyword(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.seo.keywords(selectedCompanyId!) }),
  });

  if (!selectedCompanyId) return null;

  return (
    <div className="space-y-4 max-w-5xl">
      {showAdd && (
        <AddKeywordDialog companyId={selectedCompanyId} onClose={() => setShowAdd(false)} />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Keywords</h1>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Keyword
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : keywords.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-3">No keywords tracked yet.</p>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Keyword
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Keyword</th>
                <th className="px-4 py-2 text-left font-medium">Target URL</th>
                <th className="px-4 py-2 text-right font-medium">Volume</th>
                <th className="px-4 py-2 text-right font-medium">Difficulty</th>
                <th className="px-4 py-2 text-right font-medium">Rank</th>
                <th className="px-4 py-2 text-right font-medium">Target</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keywords.map((kw: SeoKeyword) => {
                const rankDelta =
                  kw.currentRank != null && kw.targetRank != null
                    ? kw.targetRank - kw.currentRank
                    : null;
                return (
                  <tr key={kw.id} className="hover:bg-accent/20">
                    <td className="px-4 py-2 font-medium">{kw.keyword}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-[180px]">
                      {kw.targetUrl ? (
                        <a
                          href={kw.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-primary"
                        >
                          {kw.targetUrl.replace(/^https?:\/\//, "")}
                        </a>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {kw.searchVolume != null ? kw.searchVolume.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {kw.difficulty != null ? (
                        <span
                          className={
                            kw.difficulty >= 70
                              ? "text-destructive font-medium"
                              : kw.difficulty >= 40
                              ? "text-yellow-600 dark:text-yellow-400 font-medium"
                              : "text-emerald-600 dark:text-emerald-400 font-medium"
                          }
                        >
                          {kw.difficulty}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {kw.currentRank ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {kw.targetRank != null ? (
                        <span>
                          {kw.targetRank}
                          {rankDelta != null && rankDelta < 0 && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">
                              ({rankDelta})
                            </span>
                          )}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(kw.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
