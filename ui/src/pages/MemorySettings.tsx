import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMemoryBindings, createMemoryBinding, deleteMemoryBinding, updateMemoryBinding } from "@/api/memory";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Brain, Plus, Trash2, Loader2 } from "lucide-react";
import type { MemoryBinding, CreateMemoryBinding, MemoryProviderKind, MemoryScope } from "@paperclipai/shared";

const SCOPE_LABELS: Record<MemoryScope, string> = {
  company: "Company-wide",
  agent: "Agent-specific",
  project: "Project-specific",
  issue: "Issue-specific",
};

const PROVIDER_LABELS: Record<MemoryProviderKind, string> = {
  chroma: "ChromaDB Vector",
  markdown: "Markdown Files",
};

export function MemorySettings() {
  const { selectedCompanyId: companyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newScope, setNewScope] = useState<MemoryScope>("company");
  const [newProvider, setNewProvider] = useState<MemoryProviderKind>("chroma");
  const [newAgentId, setNewAgentId] = useState("");

  const bindingsQuery = useQuery({
    queryKey: queryKeys.memory.bindings(companyId ?? ""),
    queryFn: () => getMemoryBindings(companyId!),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateMemoryBinding) => createMemoryBinding(companyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memory.bindings(companyId ?? "") });
      setCreateOpen(false);
      setNewAgentId("");
      pushToast({ title: "Memory binding created", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Create failed", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMemoryBinding(companyId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memory.bindings(companyId ?? "") });
      pushToast({ title: "Binding deleted", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Delete failed", tone: "error" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      updateMemoryBinding(companyId!, id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.memory.bindings(companyId ?? "") });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Update failed", tone: "error" }),
  });

  if (!companyId) {
    return <div className="text-sm text-muted-foreground">Select a company to manage memory bindings.</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">MemPalace</h1>
          <p className="text-sm text-muted-foreground">
            Configure agent memory bindings. Memories are stored as vector embeddings for semantic retrieval.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Binding
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Memory Binding</DialogTitle>
              <DialogDescription>Define a memory scope for semantic storage and retrieval.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Scope</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as MemoryScope)}
                >
                  <option value="company">Company-wide</option>
                  <option value="agent">Agent-specific</option>
                  <option value="project">Project-specific</option>
                  <option value="issue">Issue-specific</option>
                </select>
              </div>
              {newScope === "agent" && (
                <div className="space-y-2">
                  <Label>Agent ID</Label>
                  <Input
                    placeholder="Agent UUID"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Provider</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value as MemoryProviderKind)}
                >
                  <option value="chroma">ChromaDB Vector</option>
                  <option value="markdown">Markdown Files</option>
                </select>
              </div>
              <Button
                className="w-full"
                disabled={createMutation.isPending || (newScope === "agent" && !newAgentId)}
                onClick={() =>
                  createMutation.mutate({
                    scope: newScope,
                    providerKind: newProvider,
                    agentId: newScope === "agent" ? newAgentId : undefined,
                    enabled: true,
                  })
                }
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Create Binding
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {bindingsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading bindings...
        </div>
      ) : bindingsQuery.data?.length === 0 ? (
        <div className="text-sm text-muted-foreground">No memory bindings yet. Create one to get started.</div>
      ) : (
        <div className="space-y-2">
          {bindingsQuery.data?.map((binding: MemoryBinding) => (
            <div
              key={binding.id}
              className="flex items-center justify-between rounded-lg border bg-card p-4"
            >
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">
                    {SCOPE_LABELS[binding.scope]}
                    {binding.agentId && <span className="text-muted-foreground"> · Agent {binding.agentId.slice(0, 8)}</span>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {PROVIDER_LABELS[binding.providerKind]} · Created {new Date(binding.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={binding.enabled}
                    onCheckedChange={(checked) => toggleMutation.mutate({ id: binding.id, enabled: checked as boolean })}
                  />
                  <span className="text-xs text-muted-foreground">{binding.enabled ? "Enabled" : "Disabled"}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => deleteMutation.mutate(binding.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
