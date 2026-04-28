import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { modelsApi, type AllowedModel, type VllmEndpoint, type ApiKeyStatus, type DiscoveredModel } from "../api/models";
import { agentsApi, type AdapterModel } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { PageSkeleton } from "../components/PageSkeleton";
import { Tooltip } from "../components/Tooltip";
import {
  Cpu,
  Save,
  Sparkles,
  Trash2,
  Plus,
  RefreshCw,
  Server,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plug,
  Bot,
  Code,
  Zap,
  Terminal,
  Box,
  Globe,
  Star,
  ExternalLink,
  Lock,
  Key,
  Search,
  X,
} from "lucide-react";

// ─── Provider definitions ────────────────────────────────────────────────────

type ProviderDef = {
  type: string;
  label: string;
  description: string;
  dynamic: boolean; // fetches models at runtime (may be slow)
  icon: React.ElementType;
};

const PROVIDERS: ProviderDef[] = [
  {
    type: "claude_local",
    label: "Claude Code",
    description: "Anthropic Claude models via the Claude Code CLI",
    dynamic: false,
    icon: Bot,
  },
  {
    type: "codex_local",
    label: "Codex / OpenAI",
    description: "OpenAI models via the Codex CLI — refreshes from OpenAI API when a key is configured",
    dynamic: true,
    icon: Code,
  },
  {
    type: "gemini_local",
    label: "Gemini CLI",
    description: "Google Gemini models via the Gemini CLI",
    dynamic: false,
    icon: Sparkles,
  },
  {
    type: "opencode_local",
    label: "OpenCode",
    description: "All providers configured in OpenCode (Anthropic, OpenAI, Bedrock, etc.)",
    dynamic: true,
    icon: Terminal,
  },
  {
    type: "cursor",
    label: "Cursor CLI",
    description: "Cursor Agent models — refreshes from the Cursor CLI when installed",
    dynamic: true,
    icon: Zap,
  },
  {
    type: "hermes_local",
    label: "Hermes",
    description: "Hermes agent models backed by Ollama",
    dynamic: true,
    icon: Bot,
  },
  {
    type: "pi_local",
    label: "Pi",
    description: "Pi agent models",
    dynamic: true,
    icon: Bot,
  },
  {
    type: "openclaw_gateway",
    label: "OpenClaw Gateway",
    description: "Models available through the OpenClaw gateway",
    dynamic: false,
    icon: Globe,
  },
  {
    type: "github_copilot",
    label: "GitHub Copilot",
    description: "Models available via GitHub Copilot — requires gh auth login with Copilot access",
    dynamic: true,
    icon: Box,
  },
];

// ─── ProviderSection ─────────────────────────────────────────────────────────

function ProviderSection({
  provider,
  companyId,
}: {
  provider: ProviderDef;
  companyId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();

  const queryKey = ["models", "provider", provider.type, companyId];
  const { data: models, isLoading, isFetching, isError } = useQuery({
    queryKey,
    queryFn: () => agentsApi.adapterModels(companyId, provider.type),
    enabled: expanded,
    staleTime: provider.dynamic ? 30_000 : Infinity,
  });

  const Icon = provider.icon;
  const count = models?.length ?? 0;

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/20 transition-colors text-left"
      >
        <div className="rounded-md bg-muted p-1.5 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{provider.label}</p>
          <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {expanded && isFetching && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          )}
          {expanded && count > 0 && (
            <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-mono">
              {count}
            </span>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 space-y-2">
          {provider.dynamic && (
            <div className="flex justify-end mb-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => queryClient.invalidateQueries({ queryKey })}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Discovering models…
            </div>
          )}

          {isError && (
            <p className="text-xs text-destructive py-2">
              Failed to load models. Check that the adapter is installed and configured.
            </p>
          )}

          {!isLoading && !isError && models && models.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">
              No models discovered.{" "}
              {provider.dynamic
                ? "Make sure the adapter CLI is installed and authenticated."
                : "This adapter has no model list defined."}
            </p>
          )}

          {!isLoading && models && models.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {models.map((m: AdapterModel) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{m.label || m.id}</p>
                    {m.label && m.label !== m.id && (
                      <p className="text-[11px] text-muted-foreground font-mono truncate">{m.id}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OllamaSection ───────────────────────────────────────────────────────────

function OllamaSection() {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showInstallForm, setShowInstallForm] = useState(false);
  const [installName, setInstallName] = useState("");

  const installedQuery = useQuery({
    queryKey: ["models", "installed"],
    queryFn: () => modelsApi.getInstalled(),
  });

  const availableQuery = useQuery({
    queryKey: ["models", "available"],
    queryFn: () => modelsApi.getAvailable(),
    staleTime: 5 * 60_000,
  });

  const deleteModel = useMutation({
    mutationFn: (name: string) => modelsApi.deleteOllamaModel(name),
    onSuccess: (_d, name) => {
      pushToast({ title: `Removed ${name}`, tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["models", "installed"] });
    },
    onError: () => pushToast({ title: "Failed to remove model", tone: "error" }),
  });

  const installModel = useMutation({
    mutationFn: (name: string) => modelsApi.installModel(name),
    onSuccess: (_d, name) => {
      pushToast({ title: `Installing ${name}…`, tone: "info" });
      setInstallName("");
      setShowInstallForm(false);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["models", "installed"] }), 3000);
    },
    onError: () => pushToast({ title: "Install failed", tone: "error" }),
  });

  const installed = installedQuery.data ?? [];
  const available = availableQuery.data ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Ollama</h2>
          <span className="text-xs text-muted-foreground">
            — local LLM runtime
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["models", "installed"] })}
            disabled={installedQuery.isFetching}
          >
            <RefreshCw className={`h-3 w-3 ${installedQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setShowInstallForm((v) => !v)}
          >
            <Plus className="h-3 w-3" />
            Pull model
          </Button>
        </div>
      </div>

      {showInstallForm && (
        <Card className="p-3 flex items-center gap-2">
          <input
            autoFocus
            className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
            placeholder="e.g. llama3.2, qwen2.5-coder:7b"
            value={installName}
            onChange={(e) => setInstallName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && installName.trim()) installModel.mutate(installName.trim());
            }}
          />
          <Button
            size="sm"
            disabled={!installName.trim() || installModel.isPending}
            onClick={() => installModel.mutate(installName.trim())}
          >
            {installModel.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pull"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowInstallForm(false)}>Cancel</Button>
        </Card>
      )}

      {installedQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading installed models…
        </div>
      ) : installed.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Ollama models installed. Pull one above.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {installed.map((m: AdapterModel) => (
            <div
              key={m.id}
              className="group relative flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5 hover:bg-accent/20 transition-colors"
            >
              <p className="text-sm font-medium leading-tight truncate pr-5">{m.label}</p>
              <p className="text-[11px] text-muted-foreground font-mono leading-tight truncate">{m.id}</p>
              <button
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                title={`Remove ${m.label}`}
                onClick={() => deleteModel.mutate(m.label)}
                disabled={deleteModel.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {available.length > 0 && (
        <details className="group">
          <summary className="text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground">
            {available.length} models available in Ollama library — click to browse
          </summary>
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto">
            {available.map((m: AdapterModel) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-1 rounded-md border border-border px-2 py-1.5 text-xs"
              >
                <span className="font-mono truncate">{m.label}</span>
                <button
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  title={`Pull ${m.label}`}
                  onClick={() => installModel.mutate(m.label)}
                  disabled={installModel.isPending}
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── VllmSection ─────────────────────────────────────────────────────────────

function VllmSection() {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [probedModels, setProbedModels] = useState<Record<string, AdapterModel[]>>({});
  const [probing, setProbing] = useState<string | null>(null);

  const endpointsQuery = useQuery({
    queryKey: ["models", "vllm", "endpoints"],
    queryFn: () => modelsApi.getVllmEndpoints(),
  });

  const addEndpoint = useMutation({
    mutationFn: () =>
      modelsApi.addVllmEndpoint({ name: name.trim(), baseURL: baseURL.trim(), apiKey: apiKey.trim() || undefined }),
    onSuccess: () => {
      pushToast({ title: "GPU server added", tone: "success" });
      setName(""); setBaseURL(""); setApiKey(""); setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["models", "vllm", "endpoints"] });
    },
    onError: () => pushToast({ title: "Failed to add server", tone: "error" }),
  });

  const deleteEndpoint = useMutation({
    mutationFn: (id: string) => modelsApi.deleteVllmEndpoint(id),
    onSuccess: () => {
      pushToast({ title: "Server removed", tone: "success" });
      queryClient.invalidateQueries({ queryKey: ["models", "vllm", "endpoints"] });
    },
    onError: () => pushToast({ title: "Failed to remove server", tone: "error" }),
  });

  async function probeEndpoint(ep: VllmEndpoint) {
    setProbing(ep.id);
    try {
      const models = await modelsApi.probeVllmEndpoint(ep.id);
      setProbedModels((prev) => ({ ...prev, [ep.id]: models }));
    } catch {
      pushToast({ title: "Probe failed — check the server URL and API key", tone: "error" });
    } finally {
      setProbing(null);
    }
  }

  const endpoints = endpointsQuery.data?.endpoints ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">vLLM / Custom GPU Servers</h2>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1"
          onClick={() => setShowForm((v) => !v)}
        >
          <Plus className="h-3 w-3" />
          Add GPU server
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 space-y-3">
          <h3 className="text-sm font-medium">New vLLM endpoint</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <input
                autoFocus
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                placeholder="RTX 3090 server"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Base URL</label>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
                placeholder="http://192.168.1.100:8000"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              API Key <span className="font-normal">(optional — leave blank for no-auth vLLM)</span>
            </label>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
              type="password"
              placeholder="sk-… or leave blank"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 justify-end pt-1">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!name.trim() || !baseURL.trim() || addEndpoint.isPending}
              onClick={() => addEndpoint.mutate()}
            >
              {addEndpoint.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Add server
            </Button>
          </div>
        </Card>
      )}

      {endpointsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading endpoints…
        </div>
      ) : endpoints.length === 0 && !showForm ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <Server className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-1">No GPU servers configured</p>
          <p className="text-xs text-muted-foreground">
            Add a vLLM, Ollama-over-HTTP, or any OpenAI-compatible endpoint.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {endpoints.map((ep: VllmEndpoint) => (
            <Card key={ep.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{ep.name}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">{ep.baseURL}</p>
                  {ep.apiKey && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      API key: ••••{ep.apiKey.slice(-4)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1"
                    onClick={() => probeEndpoint(ep)}
                    disabled={probing === ep.id}
                  >
                    {probing === ep.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Plug className="h-3 w-3" />
                    )}
                    Probe
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-destructive hover:text-destructive"
                    onClick={() => deleteEndpoint.mutate(ep.id)}
                    disabled={deleteEndpoint.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {probedModels[ep.id] && (
                <div className="border-t border-border pt-2">
                  {probedModels[ep.id]!.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No models returned — check the server is running and serving at{" "}
                      <span className="font-mono">{ep.baseURL}/v1/models</span>
                    </p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-1.5">
                        {probedModels[ep.id]!.length} model{probedModels[ep.id]!.length !== 1 ? "s" : ""} found:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {probedModels[ep.id]!.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-mono"
                          >
                            {m.label || m.id}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ApiKeySection (shared) ───────────────────────────────────────────────────

interface UrlField {
  label: string;
  placeholder: string;
  /** Optional: show a third input row for Azure api-version */
  versionLabel?: string;
  versionPlaceholder?: string;
  versionDefault?: string;
}

function ApiKeySection({
  title,
  description,
  keyPrefix,
  queryKeyStatus,
  queryKeyModels,
  onGetStatus,
  onSaveKey,
  onRemoveKey,
  onGetModels,
  urlField,
}: {
  title: string;
  description: string;
  keyPrefix: string;
  queryKeyStatus: readonly string[];
  queryKeyModels: readonly string[];
  onGetStatus: () => Promise<ApiKeyStatus>;
  onSaveKey: (key: string, url?: string, version?: string) => Promise<{ ok: boolean; maskedKey: string }>;
  onRemoveKey: () => Promise<{ ok: boolean }>;
  onGetModels: () => Promise<AdapterModel[]>;
  /** When set, a URL input is shown alongside the API key input */
  urlField?: UrlField;
}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [inputKey, setInputKey] = useState("");
  const [inputUrl, setInputUrl] = useState("");
  const [inputVersion, setInputVersion] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [discoveredModels, setDiscoveredModels] = useState<AdapterModel[] | null>(null);
  const [discovering, setDiscovering] = useState(false);

  const statusQuery = useQuery({
    queryKey: queryKeyStatus as unknown as string[],
    queryFn: onGetStatus,
    staleTime: 60_000,
  });

  // Pre-fill URL + version from persisted status when opening the form
  function openForm() {
    const s = statusQuery.data;
    if (s?.url) setInputUrl(s.url);
    if (s?.apiVersion) setInputVersion(s.apiVersion);
    setShowInput(true);
  }

  function closeForm() {
    setShowInput(false);
    setInputKey("");
    setInputUrl("");
    setInputVersion("");
  }

  const canSave = inputKey.trim() && (!urlField || inputUrl.trim());

  const saveMutation = useMutation({
    mutationFn: () =>
      onSaveKey(
        inputKey.trim(),
        urlField ? inputUrl.trim() : undefined,
        urlField?.versionLabel ? (inputVersion.trim() || urlField.versionDefault) : undefined,
      ),
    onSuccess: (data) => {
      pushToast({ title: `${title} key saved (${data.maskedKey})`, tone: "success" });
      closeForm();
      queryClient.invalidateQueries({ queryKey: queryKeyStatus as unknown as string[] });
      queryClient.invalidateQueries({ queryKey: queryKeyModels as unknown as string[] });
      setDiscoveredModels(null);
    },
    onError: () => pushToast({ title: "Failed to save key", tone: "error" }),
  });

  const removeMutation = useMutation({
    mutationFn: onRemoveKey,
    onSuccess: () => {
      pushToast({ title: `${title} key removed`, tone: "info" });
      queryClient.invalidateQueries({ queryKey: queryKeyStatus as unknown as string[] });
      queryClient.invalidateQueries({ queryKey: queryKeyModels as unknown as string[] });
      setDiscoveredModels(null);
    },
    onError: () => pushToast({ title: "Failed to remove key", tone: "error" }),
  });

  async function discoverModels() {
    setDiscovering(true);
    try {
      const models = await onGetModels();
      setDiscoveredModels(models);
      if (models.length === 0) {
        pushToast({ title: "No models found — check your key", tone: "warn" });
      }
    } catch {
      pushToast({ title: "Discovery failed", tone: "error" });
    } finally {
      setDiscovering(false);
    }
  }

  const status = statusQuery.data;
  const configured = status?.configured ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground">— {description}</span>
        </div>
        <div className="flex items-center gap-2">
          {configured && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs gap-1"
              onClick={discoverModels}
              disabled={discovering}
            >
              {discovering ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Discover models
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={openForm}
          >
            <Key className="h-3 w-3" />
            {configured ? "Update key" : "Add key"}
          </Button>
        </div>
      </div>

      {/* Current status */}
      <Card className="p-3 flex items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full shrink-0 ${configured ? "bg-green-500" : "bg-muted-foreground/30"}`}
        />
        <div className="flex-1 min-w-0 space-y-0.5">
          {configured ? (
            <>
              <p className="text-sm font-mono text-muted-foreground">{status?.maskedKey ?? keyPrefix + "…"}</p>
              {status?.url && (
                <p className="text-xs text-muted-foreground font-mono truncate">{status.url}</p>
              )}
              {status?.apiVersion && (
                <p className="text-xs text-muted-foreground">api-version: {status.apiVersion}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No API key configured</p>
          )}
        </div>
        {configured && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive shrink-0"
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
          >
            {removeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        )}
      </Card>

      {/* Key input form */}
      {showInput && (
        <Card className="p-3 space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {configured ? "Replace credentials" : "Enter credentials"}
          </label>
          {urlField && (
            <input
              autoFocus
              type="url"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder={urlField.placeholder}
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
          )}
          {urlField?.versionLabel && (
            <input
              type="text"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder={urlField.versionPlaceholder ?? urlField.versionDefault ?? ""}
              value={inputVersion}
              onChange={(e) => setInputVersion(e.target.value)}
            />
          )}
          <div className="flex items-center gap-2">
            <input
              autoFocus={!urlField}
              type="password"
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring font-mono"
              placeholder={`${keyPrefix}…`}
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) saveMutation.mutate();
              }}
            />
            <Button
              size="sm"
              disabled={!canSave || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Discovered models */}
      {discoveredModels !== null && (
        <div className="space-y-1.5">
          {discoveredModels.length === 0 ? (
            <p className="text-xs text-muted-foreground">No models returned.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">{discoveredModels.length} models available:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5 max-h-56 overflow-y-auto">
                {discoveredModels.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col gap-0.5 rounded-md border border-border bg-card px-2.5 py-2"
                  >
                    <p className="text-xs font-medium truncate leading-tight">{m.label || m.id}</p>
                    {m.label && m.label !== m.id && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── OpenAISection ────────────────────────────────────────────────────────────

function OpenAISection() {
  return (
    <ApiKeySection
      title="OpenAI"
      description="direct API access — GPT-4o, o3, o4-mini, DALL-E, Whisper, etc."
      keyPrefix="sk-"
      queryKeyStatus={queryKeys.models.openaiKey}
      queryKeyModels={queryKeys.models.openaiModels}
      onGetStatus={() => modelsApi.getOpenAIKeyStatus()}
      onSaveKey={(key) => modelsApi.saveOpenAIKey(key)}
      onRemoveKey={() => modelsApi.removeOpenAIKey()}
      onGetModels={() => modelsApi.getOpenAIModels()}
    />
  );
}

// ─── OpenRouterSection ────────────────────────────────────────────────────────

function OpenRouterSection() {
  return (
    <ApiKeySection
      title="OpenRouter"
      description="unified access to 300+ models from Anthropic, Google, Meta, Mistral, and more"
      keyPrefix="sk-or-"
      queryKeyStatus={queryKeys.models.openrouterKey}
      queryKeyModels={queryKeys.models.openrouterModels}
      onGetStatus={() => modelsApi.getOpenRouterKeyStatus()}
      onSaveKey={(key) => modelsApi.saveOpenRouterKey(key)}
      onRemoveKey={() => modelsApi.removeOpenRouterKey()}
      onGetModels={() => modelsApi.getOpenRouterModels()}
    />
  );
}

// ─── VercelAISection ──────────────────────────────────────────────────────────

function VercelAISection() {
  return (
    <ApiKeySection
      title="Vercel AI Gateway"
      description="proxy to Anthropic, OpenAI, Google, and more via your Vercel AI gateway URL"
      keyPrefix="Bearer "
      queryKeyStatus={queryKeys.models.vercelaiKey}
      queryKeyModels={queryKeys.models.vercelaiModels}
      onGetStatus={() => modelsApi.getVercelAIKeyStatus()}
      onSaveKey={(key, url) => modelsApi.saveVercelAIKey(key, url!)}
      onRemoveKey={() => modelsApi.removeVercelAIKey()}
      onGetModels={() => modelsApi.getVercelAIModels()}
      urlField={{
        label: "Gateway URL",
        placeholder: "https://gateway.ai.vercel.app/v1/{team-id}/{gateway-name}",
      }}
    />
  );
}

// ─── AzureOpenAISection ───────────────────────────────────────────────────────

function AzureOpenAISection() {
  return (
    <ApiKeySection
      title="Azure OpenAI"
      description="Azure-hosted GPT-4o, o-series, and other OpenAI deployments"
      keyPrefix="(Azure key)"
      queryKeyStatus={queryKeys.models.azureKey}
      queryKeyModels={queryKeys.models.azureModels}
      onGetStatus={() => modelsApi.getAzureKeyStatus()}
      onSaveKey={(key, url, version) => modelsApi.saveAzureKey(key, url!, version)}
      onRemoveKey={() => modelsApi.removeAzureKey()}
      onGetModels={() => modelsApi.getAzureModels()}
      urlField={{
        label: "Azure endpoint",
        placeholder: "https://my-resource.openai.azure.com",
        versionLabel: "API version",
        versionPlaceholder: "2024-02-15-preview",
        versionDefault: "2024-02-15-preview",
      }}
    />
  );
}

// ─── OpenCodeGoSection ────────────────────────────────────────────────────────

const OPENCODE_GO_MODELS: { id: string; label: string; provider: string; tier: "standard" | "pro" }[] = [
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "Anthropic", tier: "pro" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", tier: "standard" },
  { id: "claude-haiku-3-5", label: "Claude Haiku 3.5", provider: "Anthropic", tier: "standard" },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", tier: "standard" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", tier: "standard" },
  { id: "o3", label: "o3", provider: "OpenAI", tier: "pro" },
  { id: "o4-mini", label: "o4-mini", provider: "OpenAI", tier: "standard" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", tier: "pro" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "Google", tier: "standard" },
  { id: "deepseek-r2", label: "DeepSeek R2", provider: "DeepSeek", tier: "standard" },
  { id: "grok-3", label: "Grok 3", provider: "xAI", tier: "pro" },
  { id: "grok-3-mini", label: "Grok 3 Mini", provider: "xAI", tier: "standard" },
];

const PROVIDER_BADGE_COLORS: Record<string, string> = {
  Anthropic: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  OpenAI: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Google: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  DeepSeek: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  xAI: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function OpenCodeGoSection() {
  const standardModels = OPENCODE_GO_MODELS.filter((m) => m.tier === "standard");
  const proModels = OPENCODE_GO_MODELS.filter((m) => m.tier === "pro");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">OpenCode Go</h2>
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary">
            Cloud Models
          </span>
        </div>
      </div>

      {/* Upsell card */}
      <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Zap className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-sm font-semibold">Run frontier models without API keys</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              OpenCode Go gives your agents access to the latest Anthropic, OpenAI, Google, DeepSeek, and xAI
              models — all routed through a single endpoint with built-in rate-limit management and usage
              tracking.
            </p>
          </div>
          <a
            href="https://opencode.ai/go"
            target="_blank"
            rel="noreferrer"
            className="shrink-0"
          >
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
              Learn more
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
      </Card>

      {/* Model grid */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Standard tier</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {standardModels.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5"
              >
                <p className="text-sm font-medium leading-tight truncate">{m.label}</p>
                <span
                  className={`self-start inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PROVIDER_BADGE_COLORS[m.provider] ?? "bg-muted text-muted-foreground"}`}
                >
                  {m.provider}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <p className="text-xs font-medium text-muted-foreground">Pro tier</p>
            <Lock className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {proModels.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-1 rounded-lg border border-dashed border-border bg-card/50 px-3 py-2.5 opacity-70"
              >
                <p className="text-sm font-medium leading-tight truncate">{m.label}</p>
                <span
                  className={`self-start inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PROVIDER_BADGE_COLORS[m.provider] ?? "bg-muted text-muted-foreground"}`}
                >
                  {m.provider}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ModelPickerPanel ─────────────────────────────────────────────────────────

interface PickerModel {
  id: string;
  label: string;
  provider: string;
  providerLabel: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  vercelai: "Vercel AI",
  azure: "Azure OpenAI",
  claude_local: "Claude Code",
  codex_local: "Codex / OpenAI",
  gemini_local: "Gemini CLI",
  opencode_local: "OpenCode",
  cursor: "Cursor CLI",
  hermes_local: "Hermes",
  pi_local: "Pi",
  openclaw_gateway: "OpenClaw Gateway",
};

function getProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function ModelPickerPanel({
  companyId,
  alreadyAllowed,
  onAdd,
  onClose,
}: {
  companyId: string;
  alreadyAllowed: Set<string>;
  onAdd: (models: PickerModel[]) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Fetch all API-key based models (Ollama + OpenAI + OpenRouter + Vercel AI + Azure + vLLM)
  const allModelsQuery = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => modelsApi.getAllModels(),
    staleTime: 60_000,
    retry: false,
  });

  // Fetch adapter-provider models in parallel
  const adapterQueries = useQueries({
    queries: PROVIDERS.map((p) => ({
      queryKey: ["models", "picker", "adapter", p.type, companyId],
      queryFn: () => agentsApi.adapterModels(companyId, p.type),
      staleTime: 30_000,
      retry: false,
    })),
  });

  // Merge everything into a flat PickerModel list
  const allModels = useMemo((): PickerModel[] => {
    const models: PickerModel[] = [];

    for (const m of (allModelsQuery.data?.models ?? []) as DiscoveredModel[]) {
      models.push({
        id: m.id,
        label: m.label,
        provider: m.provider,
        providerLabel: getProviderLabel(m.provider),
      });
    }

    PROVIDERS.forEach((p, i) => {
      const data = adapterQueries[i]?.data ?? [];
      for (const m of data) {
        models.push({
          id: m.id,
          label: m.label || m.id,
          provider: p.type,
          providerLabel: p.label,
        });
      }
    });

    return models;
  }, [allModelsQuery.data, adapterQueries]);

  // Group by provider, filtered by search
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    const visible = q
      ? allModels.filter(
          (m) =>
            m.label.toLowerCase().includes(q) ||
            m.id.toLowerCase().includes(q) ||
            m.providerLabel.toLowerCase().includes(q),
        )
      : allModels;
    const groups = new Map<string, { label: string; models: PickerModel[] }>();
    for (const m of visible) {
      if (!groups.has(m.provider)) {
        groups.set(m.provider, { label: m.providerLabel, models: [] });
      }
      groups.get(m.provider)!.models.push(m);
    }
    return groups;
  }, [allModels, search]);

  const isLoading =
    allModelsQuery.isLoading || adapterQueries.some((q) => q.isLoading);
  const hasAny = allModels.length > 0;
  const selectableCount = allModels.filter((m) => !alreadyAllowed.has(m.id)).length;
  const selectedModels = allModels.filter((m) => selected.has(m.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card className="p-4 space-y-3 border-primary/30">
      {/* Search bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
            placeholder="Search models…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tooltip content="Close">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading models from all providers…
        </div>
      )}

      {!isLoading && !hasAny && (
        <p className="text-xs text-muted-foreground py-3 text-center">
          No models found. Configure API keys and providers above to populate this list.
        </p>
      )}

      {!isLoading && hasAny && (
        <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
          {[...grouped.entries()].map(([providerKey, group]) => {
            const selectable = group.models.filter((m) => !alreadyAllowed.has(m.id));
            return (
              <div key={providerKey}>
                <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-card/90 py-0.5">
                  <span className="text-xs font-semibold text-foreground">{group.label}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
                    {group.models.length}
                  </span>
                  {selectable.length > 0 && (
                    <button
                      type="button"
                      className="ml-auto text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          selectable.forEach((m) => next.add(m.id));
                          return next;
                        })
                      }
                    >
                      select all
                    </button>
                  )}
                </div>
                <div className="space-y-0.5">
                  {group.models.map((m) => {
                    const alreadyAdded = alreadyAllowed.has(m.id);
                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 ${
                          alreadyAdded
                            ? "opacity-40 cursor-default"
                            : "hover:bg-accent/20 cursor-pointer"
                        }`}
                        onClick={() => !alreadyAdded && toggle(m.id)}
                      >
                        <Checkbox
                          checked={alreadyAdded || selected.has(m.id)}
                          disabled={alreadyAdded}
                          onCheckedChange={() => !alreadyAdded && toggle(m.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{m.label}</p>
                          {m.label !== m.id && (
                            <p className="text-[10px] text-muted-foreground font-mono truncate">{m.id}</p>
                          )}
                        </div>
                        {alreadyAdded && (
                          <span className="text-[10px] text-muted-foreground shrink-0">added</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border">
        <span className="text-xs text-muted-foreground">{selectableCount} selectable</span>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={selected.size === 0}
            onClick={() => {
              onAdd(selectedModels);
              onClose();
            }}
          >
            <Plus className="h-3 w-3" />
            Add {selected.size > 0 ? `${selected.size} ` : ""}selected
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── ProPlusSection ───────────────────────────────────────────────────────────

function ProPlusSection({
  companyId,
  localModels,
  setLocalModels,
  hasChanges,
  setHasChanges,
  onSave,
  onReset,
  saving,
}: {
  companyId: string;
  localModels: AllowedModel[];
  setLocalModels: React.Dispatch<React.SetStateAction<AllowedModel[]>>;
  hasChanges: boolean;
  setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const alreadyAllowed = useMemo(() => new Set(localModels.map((m) => m.modelId)), [localModels]);

  const isProPlus = localModels.length > 0;

  const toggle = (modelId: string) => {
    setLocalModels((prev) =>
      prev.map((m) => (m.modelId === modelId ? { ...m, enabled: !m.enabled } : m)),
    );
    setHasChanges(true);
  };

  const removeModel = (modelId: string) => {
    setLocalModels((prev) => prev.filter((m) => m.modelId !== modelId));
    setHasChanges(true);
  };

  const enableAll = () => {
    setLocalModels((p) => p.map((m) => ({ ...m, enabled: true })));
    setHasChanges(true);
  };

  const disableAll = () => {
    setLocalModels((p) => p.map((m) => ({ ...m, enabled: false })));
    setHasChanges(true);
  };

  const addModels = (models: PickerModel[]) => {
    const newEntries: AllowedModel[] = models
      .filter((m) => !alreadyAllowed.has(m.id))
      .map((m) => ({
        id: `temp_${m.id}`,
        companyId,
        modelId: m.id,
        provider: m.provider,
        enabled: true,
        allowedAt: new Date().toISOString(),
        allowedByUserId: null,
      }));
    if (newEntries.length > 0) {
      setLocalModels((prev) => [...prev, ...newEntries]);
      setHasChanges(true);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Allowed Models</h2>
          <span className="text-xs text-muted-foreground">— Pro+ feature</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={() => setShowPicker((v) => !v)}
          >
            <Plus className="h-3 w-3" />
            Browse &amp; add
          </Button>
          {hasChanges && (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onReset}>
                Reset
              </Button>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={onSave} disabled={saving}>
                <Save className="h-3 w-3" />
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Model picker panel */}
      {showPicker && (
        <ModelPickerPanel
          companyId={companyId}
          alreadyAllowed={alreadyAllowed}
          onAdd={addModels}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Free tier info */}
      {!isProPlus && !showPicker && (
        <Card className="p-4 border-dashed border-primary/50 bg-primary/5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Free tier — all models available</p>
              <p className="text-sm text-muted-foreground">
                Click "Browse &amp; add" to restrict which models agents can use (enables Pro+).
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Pro+ model list */}
      {isProPlus && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {localModels.length} model{localModels.length !== 1 ? "s" : ""} in allow-list
            </span>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={enableAll}>
                Enable all
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={disableAll}>
                Disable all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  setLocalModels([]);
                  setHasChanges(true);
                }}
              >
                Disable Pro+
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            {localModels.map((m) => (
              <Card
                key={m.modelId}
                className={`px-3 py-2 flex items-center gap-3 ${m.enabled ? "" : "opacity-50"}`}
              >
                <span className="text-xs font-mono uppercase text-muted-foreground w-20 shrink-0 truncate">
                  {m.provider}
                </span>
                <span className="flex-1 text-sm font-medium truncate">{m.modelId}</span>
                <Checkbox checked={m.enabled} onCheckedChange={() => toggle(m.modelId)} />
                <Tooltip content="Remove from allow-list">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive transition-colors ml-1 shrink-0"
                    onClick={() => removeModel(m.modelId)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── ModelSettings (page) ────────────────────────────────────────────────────

export function ModelSettings() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [localModels, setLocalModels] = useState<AllowedModel[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? "Company" },
      { label: "Settings" },
      { label: "Models" },
    ]);
  }, [setBreadcrumbs, selectedCompany?.name]);

  const allowedQuery = useQuery({
    queryKey: queryKeys.models.allowed(selectedCompanyId!),
    queryFn: () => modelsApi.getAllowedModels(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (allowedQuery.data) {
      setLocalModels(allowedQuery.data.models);
      setHasChanges(false);
    }
  }, [allowedQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) return;
      await modelsApi.updateAllowedModels(
        selectedCompanyId,
        localModels.map((m) => ({ modelId: m.modelId, provider: m.provider, enabled: m.enabled })),
      );
    },
    onSuccess: () => {
      pushToast({ title: "Allowed models saved", tone: "success" });
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.models.allowed(selectedCompanyId!) });
    },
    onError: () => pushToast({ title: "Failed to save", tone: "error" }),
  });

  if (allowedQuery.isLoading) return <PageSkeleton />;
  if (!selectedCompanyId) return null;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Cpu className="h-5 w-5 text-muted-foreground" />
        <div>
          <h1 className="text-lg font-semibold">Model Management</h1>
          <p className="text-sm text-muted-foreground">
            Browse models for each provider, manage GPU servers, and configure allowed models.
          </p>
        </div>
      </div>

      {/* Per-provider model browser */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" />
          Provider Models
        </h2>
        <p className="text-xs text-muted-foreground -mt-1">
          Expand a provider to see its available models. Dynamic providers query the adapter CLI at runtime.
        </p>
        <div className="space-y-2">
          {PROVIDERS.map((p) => (
            <ProviderSection key={p.type} provider={p} companyId={selectedCompanyId} />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Ollama */}
      <OllamaSection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* vLLM / GPU Servers */}
      <VllmSection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* OpenAI direct API */}
      <OpenAISection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* OpenRouter */}
      <OpenRouterSection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Vercel AI Gateway */}
      <VercelAISection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Azure OpenAI */}
      <AzureOpenAISection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* OpenCode Go cloud models */}
      <OpenCodeGoSection />

      {/* Divider */}
      <div className="border-t border-border" />

      {/* Pro+ Allowed Models */}
      <ProPlusSection
        companyId={selectedCompanyId}
        localModels={localModels}
        setLocalModels={setLocalModels}
        hasChanges={hasChanges}
        setHasChanges={setHasChanges}
        onSave={() => saveMutation.mutate()}
        onReset={() => { setLocalModels(allowedQuery.data?.models ?? []); setHasChanges(false); }}
        saving={saveMutation.isPending}
      />
    </div>
  );
}
