import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Sparkles,
  Loader2,
  Copy,
  Check,
  FileText,
  AlignLeft,
} from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { copywritingApi } from "../api/copywriting";
import { queryKeys } from "../lib/queryKeys";
import {
  COPYWRITING_CONTENT_TYPES,
  COPYWRITING_BRIEF_STATUSES,
} from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "../components/PageSkeleton";

// ─── Constants ────────────────────────────────────────────────────────────────

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
  draft: "text-muted-foreground bg-muted",
  "in-progress": "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-950",
  review: "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-950",
  approved: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950",
  published: "text-emerald-800 bg-emerald-200 dark:text-emerald-200 dark:bg-emerald-900 font-semibold",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export function CopywritingBriefDetail() {
  const { briefId } = useParams<{ briefId: string }>();
  const navigate = useNavigate();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const qc = useQueryClient();

  // ── Remote data ──────────────────────────────────────────────────────────
  const { data: brief, isLoading, isError } = useQuery({
    queryKey: queryKeys.copywriting.brief(briefId!),
    queryFn: () => copywritingApi.getBrief(briefId!),
    enabled: !!briefId,
  });

  // ── Local editable state ─────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState("blog-post");
  const [status, setStatus] = useState("draft");
  const [targetKeyword, setTargetKeyword] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [wordCountTarget, setWordCountTarget] = useState("");
  const [briefText, setBriefText] = useState("");
  const [notes, setNotes] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");
  const [metaDirty, setMetaDirty] = useState(false);
  const [contentDirty, setContentDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  // Seed local state once the brief loads
  useEffect(() => {
    if (!brief) return;
    setTitle(brief.title);
    setContentType(brief.contentType);
    setStatus(brief.status);
    setTargetKeyword(brief.targetKeyword ?? "");
    setTargetAudience(brief.targetAudience ?? "");
    setWordCountTarget(brief.wordCountTarget?.toString() ?? "");
    setBriefText(brief.brief ?? "");
    setNotes(brief.notes ?? "");
    setGeneratedContent(brief.generatedContent ?? "");
    setMetaDirty(false);
    setContentDirty(false);
  }, [brief]);

  // Breadcrumbs
  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Copywriting", href: `/${selectedCompanyId}/copywriting` },
      { label: "Briefs", href: `/${selectedCompanyId}/copywriting/briefs` },
      { label: brief?.title ?? "Brief" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name, selectedCompanyId, brief?.title]);

  // ── Mutations ────────────────────────────────────────────────────────────

  const saveMeta = useMutation({
    mutationFn: () =>
      copywritingApi.updateBrief(briefId!, {
        title: title.trim(),
        contentType,
        status,
        targetKeyword: targetKeyword.trim() || null,
        targetAudience: targetAudience.trim() || null,
        wordCountTarget: wordCountTarget ? parseInt(wordCountTarget, 10) : null,
        brief: briefText.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.copywriting.brief(briefId!), updated);
      qc.invalidateQueries({ queryKey: queryKeys.copywriting.briefs(selectedCompanyId!) });
      setMetaDirty(false);
      pushToast({ title: "Brief saved", tone: "success" });
    },
    onError: () => pushToast({ title: "Failed to save brief", tone: "error" }),
  });

  const saveContent = useMutation({
    mutationFn: () =>
      copywritingApi.updateBrief(briefId!, {
        generatedContent: generatedContent || null,
        generatedWordCount: generatedContent
          ? generatedContent.trim().split(/\s+/).filter(Boolean).length
          : null,
      }),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.copywriting.brief(briefId!), updated);
      setContentDirty(false);
      pushToast({ title: "Content saved", tone: "success" });
    },
    onError: () => pushToast({ title: "Failed to save content", tone: "error" }),
  });

  const generate = useMutation({
    mutationFn: () => copywritingApi.generateContent(briefId!),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.copywriting.brief(briefId!), updated);
      qc.invalidateQueries({ queryKey: queryKeys.copywriting.briefs(selectedCompanyId!) });
      setGeneratedContent(updated?.generatedContent ?? "");
      setStatus(updated?.status ?? status);
      setContentDirty(false);
      pushToast({ title: "Content generated", tone: "success" });
    },
    onError: () =>
      pushToast({ title: "Generation failed — check Ollama is reachable", tone: "error" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  const wordCount = generatedContent
    ? generatedContent.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const copyToClipboard = async () => {
    if (!generatedContent) return;
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (isLoading) return <PageSkeleton />;

  if (isError || !brief) {
    return (
      <div className="py-20 text-center space-y-3">
        <p className="text-muted-foreground">Brief not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{brief.title}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[brief.status] ?? "text-muted-foreground bg-muted"}`}
              >
                {STATUS_LABELS[brief.status] ?? brief.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {CONTENT_TYPE_LABELS[brief.contentType] ?? brief.contentType}
              </span>
              {brief.generatedWordCount != null && (
                <span className="text-xs text-muted-foreground">
                  · {brief.generatedWordCount.toLocaleString()} words generated
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Brief metadata ───────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              Brief
            </h2>
            {metaDirty && (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => saveMeta.mutate()}
                disabled={saveMeta.isPending}
              >
                {saveMeta.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Save
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Title</label>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setMetaDirty(true); }}
              />
            </div>

            {/* Content type + Status row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Type</label>
                <select
                  value={contentType}
                  onChange={(e) => { setContentType(e.target.value); setMetaDirty(true); }}
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                  {COPYWRITING_CONTENT_TYPES.map((ct) => (
                    <option key={ct} value={ct}>
                      {CONTENT_TYPE_LABELS[ct] ?? ct}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <select
                  value={status}
                  onChange={(e) => { setStatus(e.target.value); setMetaDirty(true); }}
                  className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                >
                  {COPYWRITING_BRIEF_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s] ?? s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Keyword + Audience */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Target Keyword</label>
                <Input
                  value={targetKeyword}
                  onChange={(e) => { setTargetKeyword(e.target.value); setMetaDirty(true); }}
                  placeholder="e.g. email marketing"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Word Count Target</label>
                <Input
                  type="number"
                  min={1}
                  value={wordCountTarget}
                  onChange={(e) => { setWordCountTarget(e.target.value); setMetaDirty(true); }}
                  placeholder="e.g. 1500"
                />
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Target Audience</label>
              <Input
                value={targetAudience}
                onChange={(e) => { setTargetAudience(e.target.value); setMetaDirty(true); }}
                placeholder="e.g. SaaS founders"
              />
            </div>

            {/* Brief textarea */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Brief</label>
              <textarea
                value={briefText}
                onChange={(e) => { setBriefText(e.target.value); setMetaDirty(true); }}
                placeholder="Describe what this piece should cover, tone, structure…"
                rows={5}
                className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Notes</label>
              <Input
                value={notes}
                onChange={(e) => { setNotes(e.target.value); setMetaDirty(true); }}
                placeholder="Internal notes"
              />
            </div>
          </div>
        </div>

        {/* ── Right: Generated content ───────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-1.5">
              <AlignLeft className="h-3.5 w-3.5 text-muted-foreground" />
              Generated Content
              {wordCount > 0 && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  ({wordCount.toLocaleString()} words)
                </span>
              )}
            </h2>
            <div className="flex items-center gap-1.5">
              {generatedContent && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs gap-1"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
              {contentDirty && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => saveContent.mutate()}
                  disabled={saveContent.isPending}
                >
                  {saveContent.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Save
                </Button>
              )}
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                {generate.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generate.isPending
                  ? "Generating…"
                  : generatedContent
                  ? "Regenerate"
                  : "Generate"}
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            {generate.isPending ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Generating content with AI…</p>
                <p className="text-xs">This may take up to a minute.</p>
              </div>
            ) : (
              <textarea
                value={generatedContent}
                onChange={(e) => {
                  setGeneratedContent(e.target.value);
                  setContentDirty(true);
                }}
                placeholder={
                  "Click Generate to create AI content based on your brief.\n\nYou can also type or paste content here manually."
                }
                className="w-full min-h-[520px] px-4 py-3 text-sm bg-transparent outline-none resize-none font-mono leading-relaxed"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
