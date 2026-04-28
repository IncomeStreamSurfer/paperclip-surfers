import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { designApi, type DesignAsset } from "../api/design";
import { queryKeys } from "../lib/queryKeys";
import {
  DESIGN_ASSET_STYLES,
  DESIGN_ASSET_STYLE_LABELS,
  DESIGN_ASPECT_RATIOS,
  type DesignAssetStyle,
} from "@paperclipai/shared";
import {
  Image,
  Sparkles,
  Trash2,
  Loader2,
  WandSparkles,
  Download,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "../components/PageSkeleton";
import { cn } from "../lib/utils";

const TEMPERATURE_LABELS: Record<number, string> = {
  1: "Strict",
  3: "Balanced–",
  5: "Balanced",
  7: "Creative+",
  10: "Wild",
};

function temperatureLabel(t: number): string {
  const key = [1, 3, 5, 7, 10].reduce((prev, curr) =>
    Math.abs(curr - t) < Math.abs(prev - t) ? curr : prev,
  );
  return TEMPERATURE_LABELS[key] ?? String(t);
}

interface GenerateFormState {
  title: string;
  prompt: string;
  style: DesignAssetStyle;
  aspectRatio: string;
  temperature: number;
  expandPrompt: boolean;
}

const DEFAULT_FORM: GenerateFormState = {
  title: "",
  prompt: "",
  style: "realistic",
  aspectRatio: "1:1",
  temperature: 5,
  expandPrompt: false,
};

export function DesignAssets() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<GenerateFormState>(DEFAULT_FORM);
  const [selectedAsset, setSelectedAsset] = useState<DesignAsset | null>(null);
  const [styleFilter, setStyleFilter] = useState<string>("all");
  const [isExpanding, setIsExpanding] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Design Studio" },
      { label: "Image Generator" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const assetsQuery = useQuery({
    queryKey: queryKeys.design.assets(selectedCompanyId!, styleFilter !== "all" ? { style: styleFilter } : {}),
    queryFn: () =>
      designApi.listAssets(
        selectedCompanyId!,
        styleFilter !== "all" ? { style: styleFilter } : {},
      ),
    enabled: !!selectedCompanyId,
    refetchInterval: (data) => {
      const hasGenerating = (data?.state?.data as DesignAsset[] | undefined)?.some(
        (a) => a.status === "generating" || a.status === "pending",
      );
      return hasGenerating ? 3000 : false;
    },
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      designApi.generateAsset(selectedCompanyId!, {
        title: form.title || `Design ${new Date().toLocaleString()}`,
        prompt: form.prompt,
        style: form.style,
        aspectRatio: form.aspectRatio,
        temperature: form.temperature,
        expandPrompt: form.expandPrompt,
      }),
    onSuccess: (asset) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.design.assets(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.design.stats(selectedCompanyId!) });
      if (asset.status === "done") {
        pushToast({ title: "Image generated!", tone: "success" });
        setSelectedAsset(asset);
      } else if (asset.status === "failed") {
        pushToast({ title: asset.errorMessage ?? "Generation failed", tone: "error" });
      } else {
        pushToast({ title: "Generation started…", tone: "info" });
      }
    },
    onError: (err) => {
      pushToast({ title: err instanceof Error ? err.message : "Generation failed", tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (assetId: string) => designApi.deleteAsset(assetId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.design.assets(selectedCompanyId!) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.design.stats(selectedCompanyId!) });
      setSelectedAsset(null);
      pushToast({ title: "Image deleted", tone: "info" });
    },
  });

  const handleExpandPrompt = async () => {
    if (!form.prompt.trim() || !selectedCompanyId) return;
    setIsExpanding(true);
    try {
      const result = await designApi.expandPrompt(selectedCompanyId, {
        description: form.prompt,
        style: form.style,
      });
      setForm((f) => ({ ...f, prompt: result.prompt }));
      pushToast({ title: "Prompt expanded", tone: "success" });
    } catch (err) {
      pushToast({
        title: err instanceof Error ? err.message : "Expand failed",
        tone: "error",
      });
    } finally {
      setIsExpanding(false);
    }
  };

  if (assetsQuery.isLoading) return <PageSkeleton />;

  const assets = assetsQuery.data ?? [];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start max-w-6xl">
      {/* ── Generate panel ────────────────────────────────────────────────── */}
      <aside className="w-full md:w-80 flex-shrink-0 rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Generate Image</h2>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Title (optional)</label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="My Design"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Prompt */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Prompt *</label>
          <div className="relative">
            <textarea
              rows={4}
              value={form.prompt}
              onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              placeholder="Describe the image you want to generate…"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <button
              type="button"
              title="Expand prompt with AI"
              disabled={!form.prompt.trim() || isExpanding}
              onClick={handleExpandPrompt}
              className="absolute right-2 bottom-2 flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-primary transition-colors disabled:opacity-40"
            >
              {isExpanding ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <WandSparkles className="h-3 w-3" />
              )}
              AI Expand
            </button>
          </div>
        </div>

        {/* Style */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Style</label>
          <div className="grid grid-cols-4 gap-1.5">
            {DESIGN_ASSET_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm((f) => ({ ...f, style: s }))}
                className={cn(
                  "rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors leading-tight",
                  form.style === s
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-muted-foreground/40 text-muted-foreground",
                )}
              >
                {DESIGN_ASSET_STYLE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect ratio */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Aspect Ratio</label>
          <div className="grid grid-cols-1 gap-1">
            {DESIGN_ASPECT_RATIOS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, aspectRatio: r.value }))}
                className={cn(
                  "flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                  form.aspectRatio === r.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:border-muted-foreground/40 text-muted-foreground",
                )}
              >
                <span>{r.label}</span>
                <span className="text-[10px] opacity-60">
                  {r.width}×{r.height}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">Creativity</label>
            <span className="text-[10px] text-muted-foreground">
              {temperatureLabel(form.temperature)}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={form.temperature}
            onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Strict</span>
            <span>Wild</span>
          </div>
        </div>

        {/* Expand prompt toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            aria-label="Toggle AI prompt expansion"
            onClick={() => setForm((f) => ({ ...f, expandPrompt: !f.expandPrompt }))}
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              form.expandPrompt ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                form.expandPrompt ? "translate-x-4.5" : "translate-x-0.5",
              )}
            />
          </button>
          <span className="text-xs text-muted-foreground">Auto-expand prompt with AI</span>
        </label>

        <Button
          className="w-full gap-2"
          disabled={!form.prompt.trim() || generateMutation.isPending}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate
            </>
          )}
        </Button>
      </aside>

      {/* ── Gallery ───────────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-4 min-w-0">
        {/* Style filter */}
        <div className="flex flex-wrap gap-1.5">
          {["all", ...DESIGN_ASSET_STYLES].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStyleFilter(s)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                styleFilter === s
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-muted-foreground/40 text-muted-foreground",
              )}
            >
              {s === "all" ? "All" : DESIGN_ASSET_STYLE_LABELS[s as DesignAssetStyle]}
            </button>
          ))}
          {assetsQuery.isFetching && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground self-center" />
          )}
        </div>

        {/* Selected asset detail */}
        {selectedAsset && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-0">
              <div className="sm:w-64 bg-muted flex-shrink-0">
                {selectedAsset.imageUrl ? (
                  <img
                    src={selectedAsset.imageUrl}
                    alt={selectedAsset.title}
                    className="w-full h-full object-contain max-h-64 sm:max-h-full"
                  />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center">
                    <Image className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{selectedAsset.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {DESIGN_ASSET_STYLE_LABELS[selectedAsset.style as DesignAssetStyle] ?? selectedAsset.style}
                      {" · "}
                      {selectedAsset.width}×{selectedAsset.height}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAsset(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                    Prompt
                  </p>
                  <p className="text-xs leading-relaxed text-foreground/80 line-clamp-4">
                    {selectedAsset.expandedPrompt ?? selectedAsset.prompt}
                  </p>
                </div>
                {selectedAsset.checkpointUsed && (
                  <p className="text-[10px] text-muted-foreground">
                    Checkpoint: {selectedAsset.checkpointUsed}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  {selectedAsset.imageUrl && (
                    <a
                      href={selectedAsset.imageUrl}
                      download={`${selectedAsset.title}.png`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                        <Download className="h-3 w-3" />
                        Download
                      </Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    onClick={() => {
                      setForm((f) => ({
                        ...f,
                        prompt: selectedAsset.prompt,
                        style: (selectedAsset.style as DesignAssetStyle) ?? f.style,
                      }));
                    }}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Re-use Prompt
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-xs text-destructive hover:text-destructive"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(selectedAsset.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Asset grid */}
        {assets.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center gap-3 text-center">
            <Image className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium">No images yet</p>
              <p className="text-xs text-muted-foreground">
                Enter a prompt on the left and click Generate.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedAsset(asset)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border bg-muted aspect-square text-left",
                  selectedAsset?.id === asset.id
                    ? "border-primary ring-2 ring-primary/30"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                {asset.status === "generating" || asset.status === "pending" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="text-[10px] text-muted-foreground">Generating…</span>
                  </div>
                ) : asset.status === "failed" ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-destructive/10">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                    <span className="text-[10px] text-destructive">Failed</span>
                  </div>
                ) : asset.imageUrl ? (
                  <img
                    src={asset.imageUrl}
                    alt={asset.title}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}

                {/* Hover overlay */}
                {asset.status === "done" && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white font-medium truncate">{asset.title}</p>
                    <p className="text-[9px] text-white/60">
                      {DESIGN_ASSET_STYLE_LABELS[asset.style as DesignAssetStyle] ?? asset.style}
                    </p>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
