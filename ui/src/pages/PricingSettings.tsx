import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPricingList, createPricingEntry, deletePricingEntry } from "@/api/pricing";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/context/ToastContext";
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
import { DollarSign, Plus, Trash2, Loader2 } from "lucide-react";
import type { ModelPricing, CreateModelPricing } from "@paperclipai/shared";

const PROVIDER_LABELS: Record<string, string> = {
  ollama: "Ollama",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  vllm: "vLLM",
  azure: "Azure OpenAI",
  vercel: "Vercel AI",
  gemini: "Google Gemini",
};

export function PricingSettings() {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [newProvider, setNewProvider] = useState("openai");
  const [newModelId, setNewModelId] = useState("");
  const [newModelName, setNewModelName] = useState("");
  const [newInputPrice, setNewInputPrice] = useState("");
  const [newOutputPrice, setNewOutputPrice] = useState("");

  const pricingQuery = useQuery({
    queryKey: ["pricing", "list"],
    queryFn: () => getPricingList(),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateModelPricing) => createPricingEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "list"] });
      setCreateOpen(false);
      setNewModelId("");
      setNewModelName("");
      setNewInputPrice("");
      setNewOutputPrice("");
      pushToast({ title: "Pricing entry created", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Create failed", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePricingEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pricing", "list"] });
      pushToast({ title: "Pricing entry deleted", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Delete failed", tone: "error" }),
  });

  const grouped = (pricingQuery.data ?? []).reduce<Record<string, ModelPricing[]>>((acc, row) => {
    if (!acc[row.provider]) acc[row.provider] = [];
    acc[row.provider].push(row);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Model Pricing Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage per-token pricing for cost verification and budget enforcement.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Pricing
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Pricing Entry</DialogTitle>
              <DialogDescription>Set per-token rates for a model.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Provider</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newProvider}
                  onChange={(e) => setNewProvider(e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="ollama">Ollama</option>
                  <option value="vllm">vLLM</option>
                  <option value="azure">Azure OpenAI</option>
                  <option value="vercel">Vercel AI</option>
                  <option value="gemini">Google Gemini</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Model ID</Label>
                <Input placeholder="e.g. gpt-4o" value={newModelId} onChange={(e) => setNewModelId(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input placeholder="e.g. GPT-4o" value={newModelName} onChange={(e) => setNewModelName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Input $/1M tokens (cents)</Label>
                  <Input type="number" placeholder="250" value={newInputPrice} onChange={(e) => setNewInputPrice(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Output $/1M tokens (cents)</Label>
                  <Input type="number" placeholder="1000" value={newOutputPrice} onChange={(e) => setNewOutputPrice(e.target.value)} />
                </div>
              </div>
              <Button
                className="w-full"
                disabled={createMutation.isPending || !newModelId}
                onClick={() =>
                  createMutation.mutate({
                    provider: newProvider,
                    modelId: newModelId,
                    modelName: newModelName || undefined,
                    inputPriceCentsPer1M: parseInt(newInputPrice || "0", 10),
                    outputPriceCentsPer1M: parseInt(newOutputPrice || "0", 10),
                    cachedInputPriceCentsPer1M: 0,
                  })
                }
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Create Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {pricingQuery.isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading pricing...
        </div>
      ) : pricingQuery.data?.length === 0 ? (
        <div className="text-sm text-muted-foreground">No pricing entries yet. Add one to get started.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([provider, rows]) => (
            <div key={provider} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {PROVIDER_LABELS[provider] ?? provider}
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Model</th>
                      <th className="text-right px-4 py-2 font-medium">Input $/1M</th>
                      <th className="text-right px-4 py-2 font-medium">Output $/1M</th>
                      <th className="text-right px-4 py-2 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-4 py-2">
                          <div className="font-medium">{row.modelName ?? row.modelId}</div>
                          <div className="text-xs text-muted-foreground font-mono">{row.modelId}</div>
                        </td>
                        <td className="px-4 py-2 text-right">
                          ${(row.inputPriceCentsPer1M / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ${(row.outputPriceCentsPer1M / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => deleteMutation.mutate(row.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
