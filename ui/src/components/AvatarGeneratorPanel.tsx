import { useState, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Loader2, Wand2, Thermometer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { agentsApi } from "../api/agents";
import { modelsApi } from "../api/models";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AvatarStyle =
  | "realistic"
  | "cartoon"
  | "anime"
  | "oil-painting"
  | "watercolor"
  | "pixel-art"
  | "3d-render"
  | "sketch";

type AvatarGender = "male" | "female" | "neutral";

interface AvatarGeneratorPanelProps {
  agentId: string;
  companyId?: string;
  onGenerated: (avatarUrl: string) => void;
}

// ─── Options ──────────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { value: AvatarStyle; label: string; emoji: string }[] = [
  { value: "realistic",    label: "Realistic",    emoji: "📷" },
  { value: "cartoon",      label: "Cartoon",      emoji: "🎨" },
  { value: "anime",        label: "Anime",        emoji: "⛩️" },
  { value: "oil-painting", label: "Oil Painting", emoji: "🖼️" },
  { value: "watercolor",   label: "Watercolor",   emoji: "💧" },
  { value: "sketch",       label: "Sketch",       emoji: "✏️" },
  { value: "3d-render",    label: "3D Render",    emoji: "🧊" },
  { value: "pixel-art",    label: "Pixel Art",    emoji: "👾" },
];

const GENDER_OPTIONS: { value: AvatarGender; label: string }[] = [
  { value: "neutral", label: "Neutral" },
  { value: "male",    label: "Male" },
  { value: "female",  label: "Female" },
];

const TEMP_MARKS = [
  { value: 1,  label: "Strict" },
  { value: 5,  label: "Balanced" },
  { value: 10, label: "Creative" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AvatarGeneratorPanel({ agentId, companyId, onGenerated }: AvatarGeneratorPanelProps) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<AvatarStyle>("realistic");
  const [gender, setGender] = useState<AvatarGender>("neutral");
  const [temperature, setTemperature] = useState(5);
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");

  const autoGenerateRef = useRef(false);

  // ── Checkpoint availability ───────────────────────────────────────────────
  const checkpointsQuery = useQuery({
    queryKey: ["models", "image-checkpoints"],
    queryFn: () => modelsApi.getImageCheckpoints(),
    staleTime: 60_000,
  });

  const hasImageModels =
    checkpointsQuery.isLoading ||        // optimistic while loading
    (checkpointsQuery.data?.available ?? false);

  // ── Mutations ─────────────────────────────────────────────────────────────
  const generate = useMutation({
    mutationFn: (customPrompt?: string) =>
      agentsApi.generateAvatar(
        agentId,
        {
          style,
          gender,
          temperature,
          customPrompt: customPrompt ?? (prompt || undefined),
        },
        companyId,
      ),
    onSuccess: (data) => {
      onGenerated(data.avatarUrl);
      autoGenerateRef.current = false;
      setOpen(false);
    },
  });

  const expand = useMutation({
    mutationFn: () =>
      agentsApi.expandAvatarPrompt(
        agentId,
        { description: description || undefined, style, gender },
        companyId,
      ),
    onSuccess: (data) => {
      setPrompt(data.prompt);
      if (autoGenerateRef.current) {
        generate.mutate(data.prompt);
      }
    },
  });

  const isBusy = expand.isPending || generate.isPending;

  const handleGenerate = () => {
    if (!description.trim() && !prompt.trim()) {
      autoGenerateRef.current = true;
      expand.mutate();
    } else {
      autoGenerateRef.current = false;
      generate.mutate(undefined);
    }
  };

  // ── No image models → hide completely ────────────────────────────────────
  if (!checkpointsQuery.isLoading && !hasImageModels) {
    return null;
  }

  // ── Collapsed trigger ─────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
        onClick={() => setOpen(true)}
        title="Generate avatar with AI"
      >
        <Sparkles className="h-3.5 w-3.5" />
        Generate with AI
      </button>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3 w-72">

      {/* Style grid */}
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground font-medium">Style</p>
        <div className="grid grid-cols-4 gap-1">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              title={opt.label}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md border px-1 py-1.5 text-[10px] leading-tight transition-colors",
                style === opt.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
              onClick={() => setStyle(opt.value)}
              disabled={isBusy}
            >
              <span className="text-base leading-none">{opt.emoji}</span>
              <span className="truncate w-full text-center">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Gender */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Gender</p>
        <div className="flex gap-1.5">
          {GENDER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-xs transition-colors",
                gender === opt.value
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground",
              )}
              onClick={() => setGender(opt.value)}
              disabled={isBusy}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Temperature */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <Thermometer className="h-3 w-3" />
            Temperature
          </p>
          <span className="text-xs font-mono text-muted-foreground">
            {temperature} — {TEMP_MARKS.find((m) => m.value === temperature)?.label ?? "Custom"}
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={temperature}
          onChange={(e) => setTemperature(parseInt(e.target.value, 10))}
          disabled={isBusy}
          className="w-full h-1.5 accent-primary cursor-pointer"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/60 -mt-0.5">
          <span>Strict</span>
          <span>Balanced</span>
          <span>Creative</span>
        </div>
      </div>

      {/* Description + Expand */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">
          Description{" "}
          <span className="font-normal text-muted-foreground/70">(optional)</span>
        </p>
        <textarea
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none"
          rows={2}
          placeholder="e.g. senior engineer, glasses, dark hair…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isBusy}
        />
        <button
          type="button"
          disabled={isBusy}
          onClick={() => {
            autoGenerateRef.current = false;
            expand.mutate();
          }}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors",
            !isBusy
              ? "text-primary hover:bg-primary/10"
              : "text-muted-foreground cursor-not-allowed opacity-50",
          )}
        >
          {expand.isPending && !generate.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          {expand.isPending && !generate.isPending ? "Expanding…" : "Expand with AI"}
        </button>
      </div>

      {/* Prompt */}
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Prompt</p>
        <textarea
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary resize-none font-mono"
          rows={4}
          placeholder="Leave blank to auto-generate, or paste a custom prompt…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={isBusy}
        />
      </div>

      {/* Available checkpoints hint */}
      {checkpointsQuery.data && checkpointsQuery.data.checkpoints.length > 0 && (
        <p className="text-[10px] text-muted-foreground/60">
          {checkpointsQuery.data.checkpoints.length} checkpoint
          {checkpointsQuery.data.checkpoints.length !== 1 ? "s" : ""} available
        </p>
      )}

      {(generate.error || expand.error) && (
        <p className="text-xs text-destructive">
          {(generate.error ?? expand.error) instanceof Error
            ? ((generate.error ?? expand.error) as Error).message
            : "Operation failed"}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={handleGenerate}
          disabled={isBusy}
        >
          {isBusy ? (
            <>
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              {autoGenerateRef.current && expand.isPending ? "Building prompt…" : "Generating…"}
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1.5" />
              Generate
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => {
            autoGenerateRef.current = false;
            setOpen(false);
            generate.reset();
            expand.reset();
          }}
          disabled={isBusy}
        >
          Cancel
        </Button>
      </div>

      {isBusy && (
        <p className="text-xs text-muted-foreground text-center">
          {autoGenerateRef.current && expand.isPending
            ? "Expanding prompt — may take 1–5 min on first use…"
            : "Generating avatar — up to 90 seconds…"}
        </p>
      )}
    </div>
  );
}
