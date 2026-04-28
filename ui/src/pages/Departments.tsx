// ui/src/pages/Departments.tsx
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Trash2, Users, Pencil, Check, X, BookOpen, ScrollText, Brain, ChevronDown, ChevronUp, Plug } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { departmentsApi, type Department, type DepartmentMemoryEntry } from "../api/departments";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../components/EmptyState";
import { PageSkeleton } from "../components/PageSkeleton";
import { ColorPicker } from "@/components/ColorPicker";
import { INDUSTRY_MCP_CATALOG } from "@paperclipai/shared";

function colorDot(color: string | null) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full border border-border shrink-0"
      style={{ backgroundColor: color ?? "var(--muted)" }}
    />
  );
}

interface CreateFormProps {
  companyId: string;
  onCreated: () => void;
}

function CreateDepartmentForm({ companyId, onCreated }: CreateFormProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [description, setDescription] = useState("");

  const mutation = useMutation({
    mutationFn: () => departmentsApi.create(companyId, { name, color, description: description || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.list(companyId) });
      setName("");
      setDescription("");
      setColor("#6366f1");
      onCreated();
    },
    onError: () => {
      pushToast({ title: "Failed to create department", tone: "error" });
    },
  });

  return (
    <form
      className="flex flex-col gap-3 p-4 border border-border rounded-lg bg-card"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        mutation.mutate();
      }}
    >
      <h3 className="text-sm font-medium">New Department</h3>
      <div className="flex gap-2 items-center">
        <ColorPicker value={color} onChange={setColor} />
        <input
          type="text"
          placeholder="Department name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          required
        />
      </div>
      <input
        type="text"
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!name.trim() || mutation.isPending}>
          Create
        </Button>
      </div>
    </form>
  );
}

type DeptTab = "agents" | "rules" | "memory" | "mcps";

interface DeptCardProps {
  dept: Department;
  companyId: string;
}

function DepartmentCard({ dept, companyId }: DeptCardProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [addingAgent, setAddingAgent] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(dept.name);
  const [editDescription, setEditDescription] = useState(dept.description ?? "");
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<DeptTab>("agents");
  // Rules & Guidelines editing state
  const [editingRules, setEditingRules] = useState(false);
  const [rulesText, setRulesText] = useState(dept.rules ?? "");
  const [editingGuidelines, setEditingGuidelines] = useState(false);
  const [guidelinesText, setGuidelinesText] = useState(dept.guidelines ?? "");
  // MCP keys (department default MCPs)
  const [mcpKeys, setMcpKeys] = useState<string[]>(dept.mcpKeys ?? []);
  // New memory entry
  const [newMemory, setNewMemory] = useState("");

  const { data: detail } = useQuery({
    queryKey: queryKeys.departments.detail(companyId, dept.id),
    queryFn: () => departmentsApi.get(companyId, dept.id),
    enabled: expanded,
  });

  const { data: agentsData } = useQuery({
    queryKey: queryKeys.agents.list(companyId),
    queryFn: () => agentsApi.list(companyId),
    enabled: addingAgent,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.departments.list(companyId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(companyId, dept.id) });
  };

  const deleteMutation = useMutation({
    mutationFn: () => departmentsApi.delete(companyId, dept.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.departments.list(companyId) }),
    onError: () => pushToast({ title: "Failed to delete department", tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof departmentsApi.update>[2]) =>
      departmentsApi.update(companyId, dept.id, data),
    onSuccess: () => {
      invalidate();
      setIsEditing(false);
      setEditingRules(false);
      setEditingGuidelines(false);
      pushToast({ title: "Department updated", tone: "success" });
    },
    onError: () => pushToast({ title: "Failed to update department", tone: "error" }),
  });

  const addAgentMutation = useMutation({
    mutationFn: (agentId: string) => departmentsApi.addAgent(companyId, dept.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(companyId, dept.id) });
      setAddingAgent(false);
      setSelectedAgentId("");
    },
    onError: () => pushToast({ title: "Failed to add agent", tone: "error" }),
  });

  const removeAgentMutation = useMutation({
    mutationFn: (agentId: string) => departmentsApi.removeAgent(companyId, dept.id, agentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.departments.detail(companyId, dept.id) }),
    onError: () => pushToast({ title: "Failed to remove agent", tone: "error" }),
  });

  const addMemoryMutation = useMutation({
    mutationFn: (content: string) => departmentsApi.addMemory(companyId, dept.id, content),
    onSuccess: () => {
      invalidate();
      setNewMemory("");
      pushToast({ title: "Memory entry added", tone: "success" });
    },
    onError: () => pushToast({ title: "Failed to add memory entry", tone: "error" }),
  });

  const removeMemoryMutation = useMutation({
    mutationFn: (entryId: string) => departmentsApi.removeMemory(companyId, dept.id, entryId),
    onSuccess: () => invalidate(),
    onError: () => pushToast({ title: "Failed to remove memory entry", tone: "error" }),
  });

  const memberIds = new Set(detail?.agents.map((a) => a.agentId) ?? []);
  const availableAgents = (agentsData ?? []).filter((a) => !memberIds.has(a.id));
  const memory: DepartmentMemoryEntry[] = detail?.memory ?? dept.memory ?? [];

  const tabs: Array<{ id: DeptTab; label: string; icon: React.ElementType }> = [
    { id: "agents", label: "Agents", icon: Users },
    { id: "rules", label: "Rules & Guidelines", icon: ScrollText },
    { id: "memory", label: "Memory", icon: Brain },
    { id: "mcps", label: "Default MCPs", icon: Plug },
  ];

  return (
    <div className="rounded-lg bg-card border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        {colorDot(dept.color)}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full text-sm px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Department name"
              />
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full text-xs px-2 py-1 border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Description (optional)"
              />
            </div>
          ) : (
            <>
              <button
                className="text-sm font-medium truncate hover:underline text-left w-full"
                onClick={() => setExpanded((v) => !v)}
              >
                {dept.name}
              </button>
              {dept.description && (
                <p className="text-xs text-muted-foreground truncate">{dept.description}</p>
              )}
            </>
          )}
        </div>
        {isEditing ? (
          <div className="flex items-center gap-1">
            <button
              className="text-green-600 hover:text-green-700 transition-colors p-1"
              onClick={() => updateMutation.mutate({ name: editName.trim(), description: editDescription.trim() || null })}
              aria-label="Save changes"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              onClick={() => {
                setIsEditing(false);
                setEditName(dept.name);
                setEditDescription(dept.description ?? "");
              }}
              aria-label="Cancel editing"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              onClick={() => setIsEditing(true)}
              aria-label="Edit department"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              className="text-muted-foreground hover:text-destructive transition-colors p-1"
              onClick={() => {
                if (confirm(`Delete department "${dept.name}"?`)) deleteMutation.mutate();
              }}
              aria-label="Delete department"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {/* Expanded detail tabs */}
      {expanded && (
        <>
          {/* Tab bar */}
          <div className="flex border-b border-border px-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="px-4 py-3">
            {/* Agents tab */}
            {activeTab === "agents" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Members ({detail?.agents.length ?? 0})
                  </p>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => setAddingAgent(!addingAgent)}
                  >
                    {addingAgent ? "Cancel" : "+ Add agent"}
                  </button>
                </div>
                {addingAgent && (
                  <div className="flex gap-2 mb-2">
                    <select
                      className="flex-1 text-xs px-2 py-1 border border-border rounded bg-background focus:outline-none"
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                    >
                      <option value="">Select agent…</option>
                      {availableAgents.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      className="text-xs"
                      disabled={!selectedAgentId || addAgentMutation.isPending}
                      onClick={() => selectedAgentId && addAgentMutation.mutate(selectedAgentId)}
                    >
                      Add
                    </Button>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {(detail?.agents ?? []).map((agent) => (
                    <div key={agent.agentId} className="flex items-center justify-between text-sm">
                      <span className="truncate">{agent.name}</span>
                      <button
                        className="text-muted-foreground hover:text-destructive ml-2 shrink-0"
                        onClick={() => removeAgentMutation.mutate(agent.agentId)}
                        aria-label={`Remove ${agent.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {(detail?.agents ?? []).length === 0 && (
                    <p className="text-xs text-muted-foreground">No agents assigned</p>
                  )}
                </div>
              </div>
            )}

            {/* Rules & Guidelines tab */}
            {activeTab === "rules" && (
              <div className="space-y-4">
                {/* Rules */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Rules</p>
                    {editingRules ? (
                      <div className="flex gap-1">
                        <button
                          className="text-xs text-green-600 hover:text-green-700 px-2 py-0.5 border border-green-200 rounded"
                          onClick={() => updateMutation.mutate({ rules: rulesText.trim() || null })}
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </button>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 border border-border rounded"
                          onClick={() => { setEditingRules(false); setRulesText(dept.rules ?? ""); }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button className="text-xs text-primary hover:underline" onClick={() => setEditingRules(true)}>
                        Edit
                      </button>
                    )}
                  </div>
                  {editingRules ? (
                    <textarea
                      className="w-full h-32 text-sm px-3 py-2 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                      placeholder="Define rules that agents in this department must follow…"
                      value={rulesText}
                      onChange={(e) => setRulesText(e.target.value)}
                    />
                  ) : dept.rules ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-2">{dept.rules}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No rules defined</p>
                  )}
                </div>

                {/* Guidelines */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Guidelines</p>
                    {editingGuidelines ? (
                      <div className="flex gap-1">
                        <button
                          className="text-xs text-green-600 hover:text-green-700 px-2 py-0.5 border border-green-200 rounded"
                          onClick={() => updateMutation.mutate({ guidelines: guidelinesText.trim() || null })}
                          disabled={updateMutation.isPending}
                        >
                          Save
                        </button>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 border border-border rounded"
                          onClick={() => { setEditingGuidelines(false); setGuidelinesText(dept.guidelines ?? ""); }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button className="text-xs text-primary hover:underline" onClick={() => setEditingGuidelines(true)}>
                        Edit
                      </button>
                    )}
                  </div>
                  {editingGuidelines ? (
                    <textarea
                      className="w-full h-32 text-sm px-3 py-2 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y font-mono"
                      placeholder="Define style guidelines and preferences for this department…"
                      value={guidelinesText}
                      onChange={(e) => setGuidelinesText(e.target.value)}
                    />
                  ) : dept.guidelines ? (
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-2">{dept.guidelines}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No guidelines defined</p>
                  )}
                </div>
              </div>
            )}

            {/* Memory tab */}
            {activeTab === "memory" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Brain className="w-3 h-3" />
                    {memory.length} {memory.length === 1 ? "entry" : "entries"}
                  </p>
                </div>
                {/* Add new memory entry */}
                <form
                  className="flex gap-2 mb-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newMemory.trim()) return;
                    addMemoryMutation.mutate(newMemory.trim());
                  }}
                >
                  <input
                    type="text"
                    placeholder="Add a memory entry…"
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    className="flex-1 text-sm px-3 py-1.5 border border-border rounded bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!newMemory.trim() || addMemoryMutation.isPending}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </form>

                <div className="flex flex-col gap-2">
                  {memory.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No memory entries yet</p>
                  )}
                  {memory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-2 p-2 rounded bg-muted/30 text-sm group"
                    >
                      <p className="flex-1 text-sm">{entry.content}</p>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          className="text-muted-foreground hover:text-destructive ml-1"
                          onClick={() => removeMemoryMutation.mutate(entry.id)}
                          aria-label="Remove memory entry"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
             )}

            {/* MCPs tab */}
            {activeTab === "mcps" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    Select MCPs that are defaults for agents in this department.
                  </p>
                  <Button
                    size="sm"
                    className="text-xs h-7"
                    disabled={updateMutation.isPending}
                    onClick={() => updateMutation.mutate({ mcpKeys })}
                  >
                    Save
                  </Button>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                  {INDUSTRY_MCP_CATALOG.map((entry) => {
                    const checked = mcpKeys.includes(entry.key);
                    return (
                      <label
                        key={entry.key}
                        className="flex items-start gap-2.5 p-2 rounded hover:bg-muted/40 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 accent-primary"
                          checked={checked}
                          onChange={() =>
                            setMcpKeys((prev) =>
                              checked ? prev.filter((k) => k !== entry.key) : [...prev, entry.key],
                            )
                          }
                        />
                        <div>
                          <p className="text-xs font-medium">{entry.name}</p>
                          <p className="text-[11px] text-muted-foreground">{entry.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Departments() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setBreadcrumbs([{ label: "Departments" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.departments.list(selectedCompanyId!),
    queryFn: () => departmentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) return null;
  if (isLoading) return <PageSkeleton variant="list" />;

  const departments = data?.departments ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Departments</h2>
          <p className="text-sm text-muted-foreground">
            Group agents into departments, define rules, guidelines, and shared memory.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
          <Plus className="w-4 h-4 mr-1" />
          New Department
        </Button>
      </div>

      {showCreate && (
        <CreateDepartmentForm
          companyId={selectedCompanyId}
          onCreated={() => setShowCreate(false)}
        />
      )}

      {departments.length === 0 && !showCreate ? (
        <EmptyState icon={Building2} message="No departments yet. Create one to start grouping agents." />
      ) : (
        <div className="grid gap-3">
          {departments.map((dept) => (
            <DepartmentCard key={dept.id} dept={dept as Department} companyId={selectedCompanyId} />
          ))}
        </div>
      )}
    </div>
  );
}
