import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { companySkillsApi } from "../api/companySkills";
import { queryKeys } from "../lib/queryKeys";
import { AGENT_ROLES } from "@paperclipai/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronDown, ChevronRight, Download, LayoutTemplate, Search, Shield, Sparkles } from "lucide-react";
import { cn, agentUrl } from "../lib/utils";
import { SKILL_CATALOG, SKILL_CATEGORIES } from "../lib/skill-catalog";
import { roleLabels } from "../components/agent-config-primitives";
import { AgentConfigForm, type CreateConfigValues } from "../components/AgentConfigForm";
import { defaultCreateValues } from "../components/agent-config-defaults";
import { AGENT_TEMPLATES } from "../lib/agent-templates";
import { getUIAdapter } from "../adapters";
import { ReportsToPicker } from "../components/ReportsToPicker";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";

const SUPPORTED_ADVANCED_ADAPTER_TYPES = new Set<CreateConfigValues["adapterType"]>([
  "claude_local",
  "codex_local",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "cursor",
  "hermes_local",
  "openclaw_gateway",
]);

function createValuesForAdapterType(
  adapterType: CreateConfigValues["adapterType"],
): CreateConfigValues {
  const { adapterType: _discard, ...defaults } = defaultCreateValues;
  const nextValues: CreateConfigValues = { ...defaults, adapterType };
  if (adapterType === "codex_local") {
    nextValues.model = DEFAULT_CODEX_LOCAL_MODEL;
    nextValues.dangerouslyBypassSandbox =
      DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
  } else if (adapterType === "gemini_local") {
    nextValues.model = DEFAULT_GEMINI_LOCAL_MODEL;
  } else if (adapterType === "cursor") {
    nextValues.model = DEFAULT_CURSOR_LOCAL_MODEL;
  } else if (adapterType === "opencode_local") {
    nextValues.model = "";
  }
  return nextValues;
}

export function NewAgent() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAdapterType = searchParams.get("adapterType");
  const presetTemplate = searchParams.get("template");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [capabilities, setCapabilities] = useState<string | null>(null);
  const [reportsTo, setReportsTo] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<CreateConfigValues>(defaultCreateValues);
  const [selectedSkillKeys, setSelectedSkillKeys] = useState<string[]>([]);
  const [roleOpen, setRoleOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState<string>("All");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateName, setGenerateName] = useState("");
  const [generateDescription, setGenerateDescription] = useState("");
  const [generateError, setGenerateError] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: adapterModels,
    error: adapterModelsError,
    isLoading: adapterModelsLoading,
    isFetching: adapterModelsFetching,
  } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.agents.adapterModels(selectedCompanyId, configValues.adapterType)
      : ["agents", "none", "adapter-models", configValues.adapterType],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, configValues.adapterType),
    enabled: Boolean(selectedCompanyId),
  });

  const { data: companySkills } = useQuery({
    queryKey: queryKeys.companySkills.list(selectedCompanyId ?? ""),
    queryFn: () => companySkillsApi.list(selectedCompanyId!),
    enabled: Boolean(selectedCompanyId),
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

  useEffect(() => {
    setBreadcrumbs([
      { label: "Agents", href: "/agents" },
      { label: "New Agent" },
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (isFirstAgent) {
      if (!name) setName("CEO");
      if (!title) setTitle("CEO");
    }
  }, [isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const requested = presetAdapterType;
    if (!requested) return;
    if (!SUPPORTED_ADVANCED_ADAPTER_TYPES.has(requested as CreateConfigValues["adapterType"])) {
      return;
    }
    setConfigValues((prev) => {
      if (prev.adapterType === requested) return prev;
      return createValuesForAdapterType(requested as CreateConfigValues["adapterType"]);
    });
  }, [presetAdapterType]);

  useEffect(() => {
    if (!presetTemplate) return;
    const tpl = AGENT_TEMPLATES.find((t) => t.key === presetTemplate);
    if (!tpl) return;
    setName(tpl.name);
    setTitle(tpl.title);
    setRole(tpl.role);
    setCapabilities(tpl.capabilities);
  }, [presetTemplate]); // eslint-disable-line react-hooks/exhaustive-deps

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedCompanyId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : "Failed to create agent");
    },
  });

  const importSkill = useMutation({
    mutationFn: (source: string) =>
      companySkillsApi.importFromSource(selectedCompanyId!, source),
    onSuccess: (result, source) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId ?? "") });
      // Auto-select the newly installed skill
      const key = result.imported[0]?.key ?? source;
      setSelectedSkillKeys((prev) => prev.includes(key) ? prev : [...prev, key]);
    },
  });

  const generateSkillMutation = useMutation({
    mutationFn: () =>
      companySkillsApi.generateSkill(selectedCompanyId!, {
        name: generateName.trim(),
        description: generateDescription.trim(),
        agentRole: effectiveRole,
      }),
    onSuccess: (skill) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.companySkills.list(selectedCompanyId ?? "") });
      setSelectedSkillKeys((prev) => prev.includes(skill.key) ? prev : [...prev, skill.key]);
      setGenerateName("");
      setGenerateDescription("");
      setGenerateOpen(false);
    },
    onError: (err) => {
      setGenerateError(err instanceof Error ? err.message : "Skill generation failed");
    },
  });

  const installedKeys = useMemo(
    () => new Set((companySkills ?? []).map((s) => s.key)),
    [companySkills],
  );

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return SKILL_CATALOG.filter((entry) => {
      const matchCat = catalogCategory === "All" || entry.category === catalogCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        entry.tags.some((t) => t.includes(q))
      );
    });
  }, [catalogSearch, catalogCategory]);

  function buildAdapterConfig() {
    const adapter = getUIAdapter(configValues.adapterType);
    return adapter.buildAdapterConfig(configValues);
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    setFormError(null);
    if (configValues.adapterType === "opencode_local") {
      const selectedModel = configValues.model.trim();
      if (!selectedModel) {
        setFormError("OpenCode requires an explicit model in provider/model format.");
        return;
      }
      if (adapterModelsError) {
        setFormError(
          adapterModelsError instanceof Error
            ? adapterModelsError.message
            : "Failed to load OpenCode models.",
        );
        return;
      }
      if (adapterModelsLoading || adapterModelsFetching) {
        setFormError("OpenCode models are still loading. Please wait and try again.");
        return;
      }
      const discovered = adapterModels ?? [];
      if (!discovered.some((entry) => entry.id === selectedModel)) {
        setFormError(
          discovered.length === 0
            ? "No OpenCode models discovered. Run `opencode models` and authenticate providers."
            : `Configured OpenCode model is unavailable: ${selectedModel}`,
        );
        return;
      }
    }
    createAgent.mutate({
      name: name.trim(),
      role: effectiveRole,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(reportsTo ? { reportsTo } : {}),
      ...(selectedSkillKeys.length > 0 ? { desiredSkills: selectedSkillKeys } : {}),
      ...(capabilities ? { capabilities } : {}),
      adapterType: configValues.adapterType,
      adapterConfig: buildAdapterConfig(),
      runtimeConfig: {
        heartbeat: {
          enabled: configValues.heartbeatEnabled,
          intervalSec: configValues.intervalSec,
          wakeOnDemand: true,
          cooldownSec: 10,
          maxConcurrentRuns: 1,
        },
      },
      budgetMonthlyCents: 0,
    });
  }

  const availableSkills = (companySkills ?? []).filter((skill) => !skill.key.startsWith("paperclipai/paperclip/"));

  function toggleSkill(key: string, checked: boolean) {
    setSelectedSkillKeys((prev) => {
      if (checked) {
        return prev.includes(key) ? prev : [...prev, key];
      }
      return prev.filter((value) => value !== key);
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">New Agent</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Advanced agent configuration
        </p>
      </div>

      {presetTemplate && (
        <div className="flex items-center gap-2 rounded-md border border-blue-500/25 bg-blue-500/5 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
          Pre-filled from the <span className="font-semibold mx-0.5">{AGENT_TEMPLATES.find(t => t.key === presetTemplate)?.name ?? presetTemplate}</span> template. Adjust any fields below before saving.
        </div>
      )}

      <div className="border border-border">
        {/* Name */}
        <div className="px-4 pt-4 pb-2">
          <input
            className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
            placeholder="Agent name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Title */}
        <div className="px-4 pb-2">
          <input
            className="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/40"
            placeholder="Title (e.g. VP of Engineering)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        {/* Property chips: Role + Reports To */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-t border-border flex-wrap">
          <Popover open={roleOpen} onOpenChange={setRoleOpen}>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                  isFirstAgent && "opacity-60 cursor-not-allowed"
                )}
                disabled={isFirstAgent}
              >
                <Shield className="h-3 w-3 text-muted-foreground" />
                {roleLabels[effectiveRole] ?? effectiveRole}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-36 p-1" align="start">
              {AGENT_ROLES.map((r) => (
                <button
                  key={r}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                    r === role && "bg-accent"
                  )}
                  onClick={() => { setRole(r); setRoleOpen(false); }}
                >
                  {roleLabels[r] ?? r}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          <ReportsToPicker
            agents={agents ?? []}
            value={reportsTo}
            onChange={setReportsTo}
            disabled={isFirstAgent}
          />
        </div>

        {/* Shared config form */}
        <AgentConfigForm
          mode="create"
          values={configValues}
          onChange={(patch) => setConfigValues((prev) => ({ ...prev, ...patch }))}
          adapterModels={adapterModels}
        />

        <div className="border-t border-border px-4 py-4">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Company skills</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Optional skills from the company library. Built-in Paperclip runtime skills are added automatically.
              </p>
            </div>
            {availableSkills.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No optional company skills installed yet.
              </p>
            ) : (
              <div className="space-y-3">
                {availableSkills.map((skill) => {
                  const inputId = `skill-${skill.id}`;
                  const checked = selectedSkillKeys.includes(skill.key);
                  return (
                    <div key={skill.id} className="flex items-start gap-3">
                      <Checkbox
                        id={inputId}
                        checked={checked}
                        onCheckedChange={(next) => toggleSkill(skill.key, next === true)}
                      />
                      <label htmlFor={inputId} className="grid gap-1 leading-none">
                        <span className="text-sm font-medium">{skill.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {skill.description ?? skill.key}
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Catalog discovery */}
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => setCatalogOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-accent/30 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              Discover from catalog
              <span className="text-xs text-muted-foreground font-normal">
                ({SKILL_CATALOG.length} skills)
              </span>
            </span>
            {catalogOpen
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </button>

          {catalogOpen && (
            <div className="px-4 pb-4 space-y-3">
              {/* Search + category filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    className="w-full rounded-md border border-border bg-background pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                    placeholder="Search skills…"
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Category pills */}
              <div className="flex flex-wrap gap-1.5">
                {["All", ...SKILL_CATEGORIES].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategory(cat)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                      catalogCategory === cat
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Results */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {filteredCatalog.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">No skills match your search.</p>
                ) : (
                  filteredCatalog.map((entry) => {
                    const isInstalled = installedKeys.has(entry.importKey);
                    const isInstalling = importSkill.isPending && importSkill.variables === entry.importKey;
                    return (
                      <div
                        key={entry.importKey}
                        className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-medium">{entry.name}</span>
                            <span className="rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                              {entry.category}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                            {entry.description}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground/60">
                            {entry.installs.toLocaleString()} installs
                          </p>
                        </div>
                        <div className="shrink-0 pt-0.5">
                          {isInstalled ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-400">
                              Installed
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px]"
                              disabled={isInstalling || !selectedCompanyId}
                              onClick={() => importSkill.mutate(entry.importKey)}
                            >
                              {isInstalling ? (
                                "Installing…"
                              ) : (
                                <>
                                  <Download className="h-3 w-3 mr-1" />
                                  Install
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Generate with AI */}
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => { setGenerateOpen((o) => !o); setGenerateError(null); }}
            className="flex w-full items-center justify-between px-4 py-3 text-sm hover:bg-accent/30 transition-colors"
          >
            <span className="flex items-center gap-2 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Generate skill with AI
            </span>
            {generateOpen
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
            }
          </button>

          {generateOpen && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                Describe the skill you need and the AI will generate a complete SKILL.md for this agent.
              </p>
              <div className="space-y-2">
                <input
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  placeholder="Skill name (e.g. Weekly Digest)"
                  value={generateName}
                  onChange={(e) => setGenerateName(e.target.value)}
                />
                <textarea
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none"
                  rows={3}
                  placeholder="What should this skill do? Be specific about inputs, steps, and outputs."
                  value={generateDescription}
                  onChange={(e) => setGenerateDescription(e.target.value)}
                />
              </div>
              {generateError && (
                <p className="text-xs text-destructive">{generateError}</p>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={
                  !generateName.trim() ||
                  !generateDescription.trim() ||
                  generateSkillMutation.isPending ||
                  !selectedCompanyId
                }
                onClick={() => {
                  setGenerateError(null);
                  generateSkillMutation.mutate();
                }}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {generateSkillMutation.isPending ? "Generating…" : "Generate skill"}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          {isFirstAgent && (
            <p className="text-xs text-muted-foreground mb-2">This will be the CEO</p>
          )}
          {formError && (
            <p className="text-xs text-destructive mb-2">{formError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/agents")}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createAgent.isPending}
              onClick={handleSubmit}
            >
              {createAgent.isPending ? "Creating…" : "Create agent"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
