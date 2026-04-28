import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { useToast, type ToastTone } from "../context/ToastContext";
import { agentsApi, type AdapterModel } from "../api/agents";
import { modelsApi } from "../api/models";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageSkeleton } from "../components/PageSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "../lib/utils";
import { Search, Bot } from "lucide-react";

function ModelSelect({
  agentId,
  adapterType,
  currentModel,
  onChange,
  modelOptions,
}: {
  agentId: string;
  adapterType: string;
  currentModel: string | undefined;
  onChange: (agentId: string, model: string) => void;
  modelOptions: AdapterModel[];
}) {
  return (
    <Select value={currentModel ?? ""} onValueChange={(v) => onChange(agentId, v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {modelOptions.map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AgentModels() {
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [localUpdates, setLocalUpdates] = useState<Record<string, string>>({});

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agents = agentsData ?? [];

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return agents;
    const q = search.toLowerCase();
    return agents.filter(
      (a) => a.name.toLowerCase().includes(q) || a.adapterType.toLowerCase().includes(q),
    );
  }, [agents, search]);

  const adapterTypes = useMemo(() => {
    const types = new Set(agents.map((a) => a.adapterType));
    return Array.from(types);
  }, [agents]);

  const modelQueries = useQuery({
    queryKey: queryKeys.agents.adapterModels(selectedCompanyId!, adapterTypes[0]),
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, adapterTypes[0]),
    enabled: !!selectedCompanyId && adapterTypes.length > 0,
  });

  const getCurrentModel = (agent: typeof agents[0]) => {
    if (localUpdates[agent.id]) return localUpdates[agent.id];
    return (agent.adapterConfig as Record<string, unknown>)?.model as string | undefined;
  };

  const handleModelChange = (agentId: string, model: string) => {
    setLocalUpdates((prev) => ({ ...prev, [agentId]: model }));
  };

  const hasChanges = Object.keys(localUpdates).length > 0;

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) return;
      const updates = Object.entries(localUpdates).map(([agentId, model]) => ({ agentId, model }));
      if (updates.length === 0) return;
      await modelsApi.bulkUpdateAgentsModels(selectedCompanyId, updates);
    },
    onSuccess: () => {
      pushToast({ title: "Agent models updated successfully", tone: "success" });
      setLocalUpdates({});
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
    },
    onError: () => {
      pushToast({ title: "Failed to update agent models", tone: "error" });
    },
  });

  if (agentsLoading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Agent Models</h2>
        <Button
          size="sm"
          onClick={() => updateMutation.mutate()}
          disabled={!hasChanges || updateMutation.isPending}
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents..."
          className="pl-9"
        />
      </div>

      {filteredAgents.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No agents found
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAgents.map((agent) => {
            const currentModel = getCurrentModel(agent);
            const isChanged = !!localUpdates[agent.id];

            return (
              <Card key={agent.id} className={cn("p-4", isChanged && "border-primary")}>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <Bot className="h-5 w-5 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium truncate">{agent.name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{agent.adapterType}</div>
                    </div>
                  </div>

                  <AgentModelDropdown
                    key={`${agent.id}-${agent.adapterType}`}
                    agentId={agent.id}
                    adapterType={agent.adapterType}
                    companyId={selectedCompanyId!}
                    currentModel={currentModel}
                    onChange={handleModelChange}
                  />

                  {isChanged && (
                    <span className="text-xs text-primary font-medium">Changed</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AgentModelDropdown({
  agentId,
  adapterType,
  companyId,
  currentModel,
  onChange,
}: {
  agentId: string;
  adapterType: string;
  companyId: string;
  currentModel: string | undefined;
  onChange: (agentId: string, model: string) => void;
}) {
  const { data: models, isLoading } = useQuery({
    queryKey: queryKeys.agents.adapterModels(companyId, adapterType),
    queryFn: () => agentsApi.adapterModels(companyId, adapterType),
  });

  if (isLoading) {
    return <Skeleton className="h-10 w-[300px]" />;
  }

  return (
    <Select value={currentModel ?? ""} onValueChange={(v) => onChange(agentId, v)}>
      <SelectTrigger className="w-[300px]">
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {(models ?? []).map((model) => (
          <SelectItem key={model.id} value={model.id}>
            {model.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}