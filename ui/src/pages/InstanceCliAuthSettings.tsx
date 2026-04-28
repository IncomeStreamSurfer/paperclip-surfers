import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Github,
  KeyRound,
  Loader2,
  RefreshCw,
  Terminal,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import {
  cliCredentialsApi,
  type CliStatus,
  type GhDeviceFlowStart,
} from "../api/cliCredentials";

// ── Query key ────────────────────────────────────────────────────────────────

const CLI_STATUS_KEY = ["instance", "cli-credentials", "status"];

// ── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: CliStatus["status"] }) {
  if (status === "authenticated" || status === "api_key_set") {
    return (
      <Badge variant="outline" className="gap-1 border-green-500/40 text-green-600 dark:text-green-400">
        <CheckCircle2 className="h-3 w-3" />
        {status === "api_key_set" ? "API key set" : "Authenticated"}
      </Badge>
    );
  }
  if (status === "not_installed") {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <Circle className="h-3 w-3" />
        Not installed
      </Badge>
    );
  }
  if (status === "unauthenticated") {
    return (
      <Badge variant="outline" className="gap-1 border-yellow-500/40 text-yellow-600 dark:text-yellow-400">
        <XCircle className="h-3 w-3" />
        Not configured
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 text-muted-foreground">
      <Circle className="h-3 w-3" />
      Unknown
    </Badge>
  );
}

// ── Install panel (SSE streaming) ─────────────────────────────────────────────

type InstallState =
  | { phase: "idle" }
  | { phase: "running"; lines: string[] }
  | { phase: "done"; ok: boolean; message: string; lines: string[] }
  | { phase: "error"; message: string };

function InstallPanel({ cli, onInstalled }: { cli: CliStatus; onInstalled: () => void }) {
  const [state, setState] = useState<InstallState>({ phase: "idle" });
  const esRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [state]);

  // Clean up on unmount
  useEffect(() => {
    return () => { esRef.current?.close(); };
  }, []);

  const startInstall = useCallback(() => {
    if (esRef.current) esRef.current.close();

    setState({ phase: "running", lines: [] });

    const es = new EventSource(`/api/instance/cli-credentials/${cli.id}/install`);
    esRef.current = es;

    es.addEventListener("log", (e) => {
      const raw = e.data as string;
      // Unescape the \n placeholder the server writes
      const lines = raw.replace(/\\n/g, "\n").split("\n").filter(Boolean);
      setState((prev) => {
        if (prev.phase !== "running") return prev;
        return { phase: "running", lines: [...prev.lines, ...lines] };
      });
    });

    es.addEventListener("done", (e) => {
      es.close();
      esRef.current = null;
      try {
        const payload = JSON.parse(e.data as string) as { ok: boolean; message: string };
        setState((prev) => ({
          phase: "done",
          ok: payload.ok,
          message: payload.message,
          lines: prev.phase === "running" ? prev.lines : [],
        }));
        if (payload.ok) onInstalled();
      } catch {
        setState((prev) => ({
          phase: "done",
          ok: false,
          message: "Unexpected install response.",
          lines: prev.phase === "running" ? prev.lines : [],
        }));
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setState((prev) => ({
        phase: "error",
        message: "Connection lost during install.",
        // keep lines if any
        ...(prev.phase === "running" ? { lines: prev.lines } : {}),
      }));
    };
  }, [cli.id, onInstalled]);

  if (cli.installMethod === "system") {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        {cli.label} is bundled in the Docker image and must be installed at build time.
      </p>
    );
  }

  const lines =
    state.phase === "running" ? state.lines
    : state.phase === "done" ? state.lines
    : [];

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        {state.phase === "idle" && (
          <Button size="sm" className="gap-1.5" onClick={startInstall}>
            <Download className="h-3.5 w-3.5" />
            Install {cli.label}
          </Button>
        )}
        {state.phase === "running" && (
          <Button size="sm" disabled className="gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Installing…
          </Button>
        )}
        {state.phase === "done" && !state.ok && (
          <Button size="sm" variant="outline" onClick={startInstall} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        {state.phase === "error" && (
          <Button size="sm" variant="outline" onClick={startInstall} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
        )}
        {state.phase === "done" && state.ok && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            {state.message}
          </span>
        )}
        {state.phase === "done" && !state.ok && (
          <span className="text-sm text-destructive">{state.message}</span>
        )}
        {state.phase === "error" && (
          <span className="text-sm text-destructive">{state.message}</span>
        )}
      </div>

      {lines.length > 0 && (
        <div
          ref={logRef}
          className="max-h-48 overflow-y-auto rounded-md bg-black/90 px-3 py-2 font-mono text-xs text-green-400 leading-relaxed"
        >
          <div className="flex items-center gap-1.5 mb-1 text-muted-foreground/60">
            <Terminal className="h-3 w-3" />
            <span>install log</span>
          </div>
          {lines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
          ))}
          {state.phase === "running" && (
            <div className="mt-1 flex items-center gap-1 text-muted-foreground/60">
              <Loader2 className="h-3 w-3 animate-spin" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── API key form ─────────────────────────────────────────────────────────────

function ApiKeyForm({ cli, onDone }: { cli: CliStatus; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: () => cliCredentialsApi.setApiKey(cli.id, value),
    onSuccess: async () => {
      setValue("");
      await qc.invalidateQueries({ queryKey: CLI_STATUS_KEY });
      onDone();
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => cliCredentialsApi.clearApiKey(cli.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: CLI_STATUS_KEY });
    },
  });

  const isConfigured = cli.status === "authenticated" || cli.status === "api_key_set";
  const busy = saveMutation.isPending || clearMutation.isPending;

  return (
    <div className="mt-3 space-y-2">
      {isConfigured ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">API key is stored.</span>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs text-destructive hover:text-destructive"
            disabled={busy}
            onClick={() => clearMutation.mutate()}
          >
            {clearMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </Button>
        </div>
      ) : (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) saveMutation.mutate();
          }}
        >
          <div className="relative flex-1 max-w-sm">
            <Input
              type={visible ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={keyPlaceholder(cli.id)}
              className="pr-8 font-mono text-xs"
              autoComplete="off"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setVisible((v) => !v)}
              tabIndex={-1}
            >
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
          <Button type="submit" size="sm" disabled={!value.trim() || busy}>
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
            Save
          </Button>
        </form>
      )}
      {(saveMutation.error || clearMutation.error) && (
        <p className="text-xs text-destructive">
          {((saveMutation.error ?? clearMutation.error) as Error).message}
        </p>
      )}
    </div>
  );
}

function keyPlaceholder(cliId: string): string {
  switch (cliId) {
    case "claude": return "sk-ant-...";
    case "codex": return "sk-...";
    case "gemini": return "AIza...";
    case "opencode": return "API key";
    case "gh": return "ghp_... (Personal Access Token)";
    default: return "API key";
  }
}

// ── GitHub device flow ────────────────────────────────────────────────────────

type DeviceFlowState =
  | { phase: "idle" }
  | { phase: "pending"; data: GhDeviceFlowStart }
  | { phase: "success" }
  | { phase: "error"; message: string };

function GhAuthPanel({ cli }: { cli: CliStatus }) {
  const qc = useQueryClient();
  const [showPat, setShowPat] = useState(false);
  const [deviceFlow, setDeviceFlow] = useState<DeviceFlowState>({ phase: "idle" });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startMutation = useMutation({
    mutationFn: () => cliCredentialsApi.ghDeviceFlowStart(),
    onSuccess: (data) => {
      setDeviceFlow({ phase: "pending", data });
      const intervalMs = Math.max((data.interval ?? 5) * 1000, 5_000);
      pollRef.current = setInterval(async () => {
        try {
          const result = await cliCredentialsApi.ghDeviceFlowPoll(data.device_code);
          if (result.access_token) {
            if (pollRef.current) clearInterval(pollRef.current);
            setDeviceFlow({ phase: "success" });
            await qc.invalidateQueries({ queryKey: CLI_STATUS_KEY });
          } else if (result.error === "access_denied" || result.error === "expired_token") {
            if (pollRef.current) clearInterval(pollRef.current);
            setDeviceFlow({ phase: "error", message: result.error_description ?? result.error ?? "Access denied or token expired." });
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          setDeviceFlow({ phase: "error", message: err instanceof Error ? err.message : "Poll failed" });
        }
      }, intervalMs);
    },
    onError: (err) => {
      setDeviceFlow({ phase: "error", message: err instanceof Error ? err.message : "Failed to start device flow" });
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => cliCredentialsApi.clearApiKey("gh"),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: CLI_STATUS_KEY }); },
  });

  const isConfigured = cli.status === "authenticated" || cli.status === "api_key_set";
  const busy = startMutation.isPending || clearMutation.isPending;

  if (isConfigured) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {cli.detail ?? "GitHub CLI is authenticated."}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs text-destructive hover:text-destructive"
          disabled={busy}
          onClick={() => clearMutation.mutate()}
        >
          {clearMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          Log out
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex gap-2">
        <Button size="sm" variant={showPat ? "outline" : "default"} onClick={() => { setShowPat(false); setDeviceFlow({ phase: "idle" }); }} className="text-xs">
          OAuth (browser)
        </Button>
        <Button size="sm" variant={showPat ? "default" : "outline"} onClick={() => { setShowPat(true); setDeviceFlow({ phase: "idle" }); }} className="text-xs">
          Personal Access Token
        </Button>
      </div>

      {showPat ? (
        <ApiKeyForm cli={cli} onDone={() => {}} />
      ) : (
        <>
          {deviceFlow.phase === "idle" && (
            <Button size="sm" disabled={busy} onClick={() => startMutation.mutate()} className="gap-1.5">
              {startMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Start GitHub login
            </Button>
          )}

          {deviceFlow.phase === "pending" && (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3 max-w-sm">
              <p className="text-sm font-medium">Enter this code at GitHub</p>
              <div className="flex items-center gap-3">
                <span className="font-mono text-2xl font-bold tracking-widest text-foreground">
                  {deviceFlow.data.user_code}
                </span>
                <Button size="sm" variant="outline" asChild>
                  <a href={deviceFlow.data.verification_uri} target="_blank" rel="noreferrer" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open GitHub
                  </a>
                </Button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Waiting for you to authorize…
              </div>
              <Button size="sm" variant="ghost" className="text-xs text-muted-foreground"
                onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setDeviceFlow({ phase: "idle" }); }}>
                Cancel
              </Button>
            </div>
          )}

          {deviceFlow.phase === "success" && (
            <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              GitHub login successful!
            </p>
          )}

          {deviceFlow.phase === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-destructive">{deviceFlow.message}</p>
              <Button size="sm" variant="outline" onClick={() => setDeviceFlow({ phase: "idle" })}>
                Try again
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── CLI card ──────────────────────────────────────────────────────────────────

function CliCard({ cli, defaultExpanded = false }: { cli: CliStatus; defaultExpanded?: boolean }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const isReady = cli.status === "authenticated" || cli.status === "api_key_set";
  const isInstalled = cli.installed;
  const canConfigure = isInstalled && cli.authMethod !== "none";
  const canInstall = !isInstalled && cli.installMethod !== "system" && cli.installMethod !== "none";

  // Colour-coded left border
  const borderClass = isReady
    ? "border-l-4 border-l-green-500"
    : !isInstalled
    ? "border-l-4 border-l-muted-foreground/20"
    : "border-l-4 border-l-yellow-500";

  return (
    <div className={`rounded-lg border border-border bg-card ${borderClass}`}>
      <div className="flex items-start justify-between px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{cli.label}</span>
            <code className="text-xs text-muted-foreground bg-muted px-1 rounded">{cli.binary}</code>
            <StatusBadge status={cli.status} />
            {cli.version && (
              <span className="text-xs text-muted-foreground">{cli.version}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
            {cli.description}
          </p>
          {cli.detail && isInstalled && (
            <p className="mt-1 text-xs text-muted-foreground/70 italic truncate">{cli.detail}</p>
          )}
        </div>

        <div className="ml-4 shrink-0 flex items-center gap-2">
          {cli.homepage && (
            <a
              href={cli.homepage}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground"
              title="Documentation"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {(canConfigure || canInstall) && (
            <Button
              size="sm"
              variant={canInstall ? "secondary" : "outline"}
              className="gap-1.5 text-xs"
              onClick={() => setExpanded((v) => !v)}
            >
              {canInstall
                ? <><Download className="h-3.5 w-3.5" />{expanded ? "Hide" : "Install"}</>
                : <><KeyRound className="h-3.5 w-3.5" />{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />} {isReady ? "Manage" : "Configure"}</>
              }
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3">
          {canInstall ? (
            <InstallPanel
              cli={cli}
              onInstalled={() => {
                void qc.invalidateQueries({ queryKey: CLI_STATUS_KEY });
                setExpanded(false);
              }}
            />
          ) : cli.id === "gh" ? (
            <GhAuthPanel cli={cli} />
          ) : (
            <ApiKeyForm cli={cli} onDone={() => setExpanded(false)} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ clis }: { clis: CliStatus[] }) {
  const authed  = clis.filter((c) => c.status === "authenticated" || c.status === "api_key_set").length;
  const pending = clis.filter((c) => c.installed && c.status !== "authenticated" && c.status !== "api_key_set" && c.authMethod !== "none").length;
  const notInst = clis.filter((c) => !c.installed).length;

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <div className="flex items-center gap-1.5">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="font-medium text-green-700 dark:text-green-400">{authed}</span>
        <span className="text-muted-foreground">configured</span>
      </div>
      {pending > 0 && (
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-yellow-500" />
          <span className="font-medium text-yellow-700 dark:text-yellow-400">{pending}</span>
          <span className="text-muted-foreground">need credentials</span>
        </div>
      )}
      {notInst > 0 && (
        <div className="flex items-center gap-1.5">
          <Circle className="h-4 w-4 text-muted-foreground/50" />
          <span className="font-medium text-muted-foreground">{notInst}</span>
          <span className="text-muted-foreground">not installed</span>
        </div>
      )}
    </div>
  );
}

// ── GitHub callout banner ─────────────────────────────────────────────────────

function GhCallout({ gh }: { gh: CliStatus }) {
  if (gh.status === "authenticated" || gh.status === "api_key_set" || !gh.installed) return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-yellow-400/40 bg-yellow-50/40 dark:bg-yellow-950/20 px-4 py-3 text-sm">
      <Github className="h-4 w-4 mt-0.5 shrink-0 text-yellow-600 dark:text-yellow-400" />
      <div className="space-y-0.5">
        <p className="font-medium text-yellow-800 dark:text-yellow-300">GitHub CLI is not authenticated</p>
        <p className="text-yellow-700/80 dark:text-yellow-400/80 text-xs leading-relaxed">
          GitHub Copilot model access requires an authenticated <code className="font-mono bg-yellow-100 dark:bg-yellow-900/40 px-1 rounded">gh</code> session.
          Use the <strong>OAuth login</strong> or paste a <strong>Personal Access Token</strong> in the GitHub CLI card below.
        </p>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<CliStatus["status"], number> = {
  authenticated: 0,
  api_key_set:   0,
  unauthenticated: 1,
  unknown:       2,
  not_installed: 3,
};

export function InstanceCliAuthSettings() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const qc = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings" },
      { label: "CLI Auth" },
    ]);
  }, [setBreadcrumbs]);

  const statusQuery = useQuery({
    queryKey: CLI_STATUS_KEY,
    queryFn: () => cliCredentialsApi.getStatus(),
    refetchInterval: 30_000,
  });

  const clis = [...(statusQuery.data?.clis ?? [])].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );

  const ghCli = clis.find((c) => c.id === "gh");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-muted-foreground" />
            CLI Authentication
          </h1>
          <p className="text-sm text-muted-foreground">
            Authenticate the AI CLIs installed in this instance. Credentials are stored
            securely on the server and injected automatically when agents run.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 shrink-0"
          disabled={statusQuery.isFetching}
          onClick={() => qc.invalidateQueries({ queryKey: CLI_STATUS_KEY })}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${statusQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {statusQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking CLI status…
        </div>
      ) : statusQuery.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {statusQuery.error instanceof Error ? statusQuery.error.message : "Failed to load CLI status."}
        </div>
      ) : (
        <>
          <SummaryBar clis={clis} />
          {ghCli && <GhCallout gh={ghCli} />}
          <div className="space-y-3">
            {clis.map((cli) => (
              <CliCard
                key={cli.id}
                cli={cli}
                defaultExpanded={
                  cli.id === "gh" &&
                  cli.installed &&
                  cli.status !== "authenticated" &&
                  cli.status !== "api_key_set"
                }
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
