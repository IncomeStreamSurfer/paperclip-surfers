import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  mcpServersApi,
  type McpServer,
  type McpServerCreateRequest,
  type McpServerUpdateRequest,
} from "../api/mcpServers";
import { departmentsApi } from "../api/departments";
import { agentsApi } from "../api/agents";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { PageSkeleton } from "../components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Server,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Sparkles,
  Loader2,
  ChevronDown,
  Search,
} from "lucide-react";
import { useEffect } from "react";
import {
  INDUSTRY_MCP_CATALOG,
  INDUSTRY_MCP_SUGGESTIONS,
  type IndustryMcpEntry,
  type BusinessType,
} from "@paperclipai/shared";

const transportColors: Record<string, string> = {
  stdio: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  http: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  sse: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
};

const scopeColors: Record<string, string> = {
  company: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  agent: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
};

interface McpFormState {
  name: string;
  description: string;
  command: string;
  args: string;
  transportType: "stdio" | "http" | "sse";
  transportUrl: string;
  scope: "company" | "agent";
  agentId: string;
}

const emptyForm: McpFormState = {
  name: "",
  description: "",
  command: "",
  args: "",
  transportType: "stdio",
  transportUrl: "",
  scope: "company",
  agentId: "",
};

// ─── helpers ─────────────────────────────────────────────────────────────────

function resolveBuiltinUrl(url: string): string {
  return url.replace(
    "__PAPERCLIP_BASE_URL__",
    `${window.location.protocol}//${window.location.host}`,
  );
}

function entryToCreateRequest(entry: IndustryMcpEntry): McpServerCreateRequest {
  if (entry.transportType === "http" || entry.transportType === "sse") {
    return {
      name: entry.name,
      description: entry.description,
      command: "",
      args: [],
      transportType: entry.transportType,
      transportUrl: entry.url ? resolveBuiltinUrl(entry.url) : null,
      scope: "company",
    };
  }
  return {
    name: entry.name,
    description: entry.description,
    command: entry.command ?? "",
    args: entry.args ?? [],
    transportType: "stdio",
    transportUrl: null,
    scope: "company",
  };
}

// ─── SuggestedMcps ───────────────────────────────────────────────────────────

function SuggestedMcps({
  businessType,
  installedNames,
  companyId,
}: {
  businessType: BusinessType;
  installedNames: Set<string>;
  companyId: string;
}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const suggestedKeys = INDUSTRY_MCP_SUGGESTIONS[businessType] ?? [];
  const suggestedEntries = suggestedKeys
    .map((k) => INDUSTRY_MCP_CATALOG.find((e) => e.key === k))
    .filter((e): e is IndustryMcpEntry => !!e);

  const addMutation = useMutation({
    mutationFn: ({ entry }: { entry: IndustryMcpEntry }) =>
      mcpServersApi.create(companyId, entryToCreateRequest(entry)),
    onSuccess: (_data, { entry }) => {
      pushToast({ title: `Added "${entry.name}"`, tone: "success" });
      setAddedKeys((prev) => new Set(prev).add(entry.key));
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
    },
    onError: (_err, { entry }) =>
      pushToast({ title: `Failed to add "${entry.name}"`, tone: "warn" }),
  });

  if (suggestedEntries.length === 0) return null;

  const newEntries = suggestedEntries.filter(
    (e) => !installedNames.has(e.name) && !addedKeys.has(e.key),
  );

  if (newEntries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Suggested for your business type</h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {newEntries.length} available
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        These MCP servers are recommended for{" "}
        <span className="font-medium">{businessType.replace(/_/g, " ")}</span> companies.
        Click to add them instantly.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {newEntries.map((entry) => {
          const isPending =
            addMutation.isPending &&
            (addMutation.variables as { entry: IndustryMcpEntry } | undefined)?.entry.key ===
              entry.key;
          return (
            <Card key={entry.key} className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium">{entry.name}</p>
                  {entry.builtin && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      built-in
                    </Badge>
                  )}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      entry.transportType === "stdio"
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                        : entry.transportType === "http"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
                    )}
                  >
                    {entry.transportType}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {entry.description}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 shrink-0"
                disabled={isPending}
                onClick={() => addMutation.mutate({ entry })}
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Add
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── DepartmentSuggestedMcps ──────────────────────────────────────────────────

function DepartmentSuggestedMcps({
  installedNames,
  companyId,
}: {
  installedNames: Set<string>;
  companyId: string;
}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const { data: deptData } = useQuery({
    queryKey: queryKeys.departments.list(companyId),
    queryFn: () => departmentsApi.list(companyId),
    enabled: !!companyId,
  });

  const departments = (deptData?.departments ?? []) as Array<{ id: string; name: string; mcpKeys: string[] | null }>;

  // Collect unique MCP keys across all departments, annotated with which dept wants them
  const keyToDepts = new Map<string, string[]>();
  for (const dept of departments) {
    for (const key of dept.mcpKeys ?? []) {
      const existing = keyToDepts.get(key) ?? [];
      existing.push(dept.name);
      keyToDepts.set(key, existing);
    }
  }

  const addMutation = useMutation({
    mutationFn: ({ entry }: { entry: IndustryMcpEntry }) =>
      mcpServersApi.create(companyId, entryToCreateRequest(entry)),
    onSuccess: (_data, { entry }) => {
      pushToast({ title: `Added "${entry.name}"`, tone: "success" });
      setAddedKeys((prev) => new Set(prev).add(entry.key));
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
    },
    onError: (_err, { entry }) =>
      pushToast({ title: `Failed to add "${entry.name}"`, tone: "warn" }),
  });

  const entries = Array.from(keyToDepts.entries())
    .map(([key, depts]) => {
      const catalogEntry = INDUSTRY_MCP_CATALOG.find((e) => e.key === key);
      return catalogEntry ? { entry: catalogEntry, depts } : null;
    })
    .filter((x): x is { entry: IndustryMcpEntry; depts: string[] } => !!x)
    .filter(({ entry }) => !installedNames.has(entry.name) && !addedKeys.has(entry.key));

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Suggested by departments</h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {entries.length} available
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        These MCPs are configured as defaults in your departments.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {entries.map(({ entry, depts }) => {
          const isPending = addMutation.isPending && (addMutation.variables as { entry: IndustryMcpEntry } | undefined)?.entry.key === entry.key;
          return (
            <Card key={entry.key} className="flex items-start gap-3 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-medium">{entry.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {entry.transportType}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {entry.description}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  ↳ {depts.join(", ")}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 shrink-0"
                disabled={isPending}
                onClick={() => addMutation.mutate({ entry })}
              >
                {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Add
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── MCP category map (local, UI-only) ───────────────────────────────────────

const MCP_CATEGORY_MAP: Record<string, string[]> = {
  "Built-in": INDUSTRY_MCP_CATALOG.filter((e) => e.builtin).map((e) => e.key),
  Development: ["github-mcp", "filesystem-code", "postgres-mcp", "web-fetch"],
  Writing: [
    "builtin-writing-tools",
    "filesystem-notes",
    "languagetool-mcp",
    "pandoc-convert",
  ],
  Design: ["builtin-design-tools", "filesystem-design"],
  Engineering: [
    "builtin-cad-tools",
    "builtin-eda-tools",
    "builtin-ros-tools",
    "filesystem-cad",
  ],
  "Data & Research": [
    "builtin-r-tools",
    "builtin-research-tools",
    "builtin-ledger-tools",
  ],
  "Security & Ops": [
    "builtin-security-tools",
    "builtin-sysadmin-tools",
    "builtin-asterisk-tools",
  ],
  Specialized: ["builtin-aviation-tools", "builtin-gis-tools"],
};

const MCP_CATEGORIES = ["All", ...Object.keys(MCP_CATEGORY_MAP)] as const;

// ─── DiscoverMcps ─────────────────────────────────────────────────────────────

function DiscoverMcps({
  installedNames,
  addedKeys: externalAddedKeys,
  companyId,
}: {
  installedNames: Set<string>;
  addedKeys: Set<string>;
  companyId: string;
}) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());

  const allAdded = new Set([...externalAddedKeys, ...addedKeys]);

  const addMutation = useMutation({
    mutationFn: ({ entry }: { entry: IndustryMcpEntry }) =>
      mcpServersApi.create(companyId, entryToCreateRequest(entry)),
    onSuccess: (_data, { entry }) => {
      pushToast({ title: `Added "${entry.name}"`, tone: "success" });
      setAddedKeys((prev) => new Set(prev).add(entry.key));
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
    },
    onError: (_err, { entry }) =>
      pushToast({ title: `Failed to add "${entry.name}"`, tone: "warn" }),
  });

  const filtered = INDUSTRY_MCP_CATALOG.filter((entry) => {
    if (category !== "All") {
      const keys = MCP_CATEGORY_MAP[category] ?? [];
      if (!keys.includes(entry.key)) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !entry.name.toLowerCase().includes(q) &&
        !entry.description.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const pendingKey =
    addMutation.isPending &&
    (addMutation.variables as { entry: IndustryMcpEntry } | undefined)?.entry.key;

  return (
    <div className="space-y-2">
      {/* Toggle header */}
      <button
        type="button"
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold flex-1">Discover MCP Tools</h2>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {INDUSTRY_MCP_CATALOG.length} available
        </Badge>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted-foreground">
            Browse the full MCP catalog — built-in servers and community integrations. Click
            to install any tool instantly.
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or description…"
              className="w-full pl-8 pr-3 h-8 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            {MCP_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-medium border transition-colors",
                  category === cat
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results grid */}
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No results match your search.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filtered.map((entry) => {
                const isInstalled =
                  installedNames.has(entry.name) || allAdded.has(entry.key);
                const isPending = pendingKey === entry.key;
                return (
                  <Card key={entry.key} className="p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium">{entry.name}</p>
                        {entry.builtin && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            built-in
                          </Badge>
                        )}
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            entry.transportType === "stdio"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              : entry.transportType === "http"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
                          )}
                        >
                          {entry.transportType}
                        </Badge>
                        {isInstalled && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                          >
                            installed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {entry.description}
                      </p>
                    </div>
                    {!isInstalled && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1 shrink-0"
                        disabled={isPending}
                        onClick={() => addMutation.mutate({ entry })}
                      >
                        {isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Add
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── McpServers page ─────────────────────────────────────────────────────────

export function McpServers() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const companyId = selectedCompanyId!;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);
  const [form, setForm] = useState<McpFormState>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<McpServer | null>(null);

  useEffect(() => {
    setBreadcrumbs([{ label: "MCP Servers" }]);
  }, [setBreadcrumbs]);

  const serversQuery = useQuery({
    queryKey: queryKeys.mcpServers.list(companyId),
    queryFn: () => mcpServersApi.list(companyId),
    enabled: !!companyId,
  });

  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: McpServerCreateRequest) => mcpServersApi.create(companyId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
      pushToast({ title: "MCP server created" });
      closeDialog();
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to create MCP server" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ serverId, data }: { serverId: string; data: McpServerUpdateRequest }) =>
      mcpServersApi.update(companyId, serverId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
      pushToast({ title: "MCP server updated" });
      closeDialog();
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to update MCP server" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (serverId: string) => mcpServersApi.delete(companyId, serverId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
      pushToast({ title: "MCP server deleted" });
      setDeleteConfirm(null);
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to delete MCP server" }),
  });

  const syncMutation = useMutation({
    mutationFn: () => mcpServersApi.sync(companyId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
      pushToast({ title: `Synced ${result.imported} MCP server${result.imported !== 1 ? "s" : ""} from system` });
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to sync from system" }),
  });

  const toggleEnabledMutation = useMutation({
    mutationFn: ({ serverId, enabled }: { serverId: string; enabled: boolean }) =>
      mcpServersApi.update(companyId, serverId, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcpServers.list(companyId) });
    },
    onError: () => pushToast({ tone: "warn", title: "Failed to toggle MCP server" }),
  });

  const servers = serversQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  function openCreate() {
    setEditingServer(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(server: McpServer) {
    setEditingServer(server);
    setForm({
      name: server.name,
      description: server.description ?? "",
      command: server.command,
      args: server.args.join(" "),
      transportType: server.transportType,
      transportUrl: server.transportUrl ?? "",
      scope: server.scope,
      agentId: server.agentId ?? "",
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingServer(null);
    setForm(emptyForm);
  }

  function handleSave() {
    const payload = {
      name: form.name,
      description: form.description || null,
      command: form.command,
      args: form.args.split(/\s+/).filter(Boolean),
      transportType: form.transportType,
      transportUrl: form.transportUrl || null,
      scope: form.scope,
      agentId: form.scope === "agent" ? form.agentId || null : null,
    };

    if (editingServer) {
      updateMutation.mutate({ serverId: editingServer.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!companyId) return null;
  if (serversQuery.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">MCP Servers</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage Model Context Protocol servers for your agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5 mr-1.5", syncMutation.isPending && "animate-spin")}
            />
            {syncMutation.isPending ? "Syncing..." : "Sync with System"}
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Manually
          </Button>
        </div>
      </div>

      {/* Suggested MCPs */}
      {selectedCompany?.businessType && (
        <SuggestedMcps
          businessType={selectedCompany.businessType}
          installedNames={new Set(servers.map((s) => s.name))}
          companyId={companyId}
        />
      )}

      {/* Department-curated MCPs */}
      <DepartmentSuggestedMcps
        installedNames={new Set(servers.map((s) => s.name))}
        companyId={companyId}
      />

      {/* Discover all MCPs */}
      <DiscoverMcps
        installedNames={new Set(servers.map((s) => s.name))}
        addedKeys={new Set()}
        companyId={companyId}
      />

      {/* Servers */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Server className="h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No MCP servers configured yet. Add one manually or sync with system.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => {
            const agentName = server.agentId
              ? agents.find((a) => a.id === server.agentId)?.name ?? "Unknown agent"
              : null;

            return (
              <Card key={server.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                      <h4 className="text-sm font-medium truncate">{server.name}</h4>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          transportColors[server.transportType],
                        )}
                      >
                        {server.transportType}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={cn("text-[10px] px-1.5 py-0", scopeColors[server.scope])}
                      >
                        {server.scope}
                      </Badge>
                      {server.source === "claude_code_discovered" && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          auto-discovered
                        </Badge>
                      )}
                      {!server.enabled && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                        >
                          disabled
                        </Badge>
                      )}
                    </div>
                    {server.description && (
                      <p className="text-xs text-muted-foreground ml-6 line-clamp-2">
                        {server.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground/60 ml-6 mt-0.5 font-mono">
                      {server.command} {server.args.join(" ")}
                    </p>
                    {agentName && (
                      <p className="text-xs text-muted-foreground ml-6 mt-0.5">
                        Agent: {agentName}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() =>
                        toggleEnabledMutation.mutate({
                          serverId: server.id,
                          enabled: !server.enabled,
                        })
                      }
                      title={server.enabled ? "Disable" : "Enable"}
                    >
                      {server.enabled ? (
                        <Power className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => openEdit(server)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive"
                      onClick={() => setDeleteConfirm(server)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingServer ? "Edit MCP Server" : "Add MCP Server"}</DialogTitle>
            <DialogDescription>
              {editingServer
                ? "Update the MCP server configuration."
                : "Add a new MCP server for your agents."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Server name"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this server do?"
                rows={2}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Command</label>
              <Input
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                placeholder="e.g., npx, python, node"
                className="font-mono text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Arguments (space-separated)
              </label>
              <Input
                value={form.args}
                onChange={(e) => setForm({ ...form, args: e.target.value })}
                placeholder="e.g., -y @modelcontextprotocol/server-filesystem"
                className="font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Transport Type</label>
                <Select
                  value={form.transportType}
                  onValueChange={(v) =>
                    setForm({ ...form, transportType: v as "stdio" | "http" | "sse" })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stdio">stdio</SelectItem>
                    <SelectItem value="http">http</SelectItem>
                    <SelectItem value="sse">sse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Scope</label>
                <Select
                  value={form.scope}
                  onValueChange={(v) =>
                    setForm({ ...form, scope: v as "company" | "agent" })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(form.transportType === "http" || form.transportType === "sse") && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Transport URL</label>
                <Input
                  value={form.transportUrl}
                  onChange={(e) => setForm({ ...form, transportUrl: e.target.value })}
                  placeholder="https://..."
                  className="font-mono text-sm"
                />
              </div>
            )}

            {form.scope === "agent" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Agent</label>
                <Select
                  value={form.agentId}
                  onValueChange={(v) => setForm({ ...form, agentId: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || !form.command.trim() || isSaving}
            >
              {isSaving ? "Saving..." : editingServer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete MCP Server</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
