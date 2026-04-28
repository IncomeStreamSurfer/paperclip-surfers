import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { knowledgeApi } from "@/api/knowledge";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BookOpen, Plus, Trash2, FileText, Search, Loader2 } from "lucide-react";
import type { KnowledgeBase } from "@paperclipai/shared";
import { Link, useNavigate } from "@/lib/router";

export function KnowledgeBases() {
  const { selectedCompanyId: companyId } = useCompany();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const basesQuery = useQuery({
    queryKey: queryKeys.knowledge.bases(companyId ?? ""),
    queryFn: () => knowledgeApi.listBases(companyId!),
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => knowledgeApi.createBase(companyId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.bases(companyId ?? "") });
      setCreateOpen(false);
      setNewName("");
      setNewDescription("");
      pushToast({ title: "Knowledge base created", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Create failed", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (kbId: string) => knowledgeApi.deleteBase(companyId!, kbId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.bases(companyId ?? "") });
      pushToast({ title: "Knowledge base deleted", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Delete failed", tone: "error" }),
  });

  if (!companyId) {
    return <div className="text-sm text-muted-foreground">Select a company to manage knowledge bases.</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold">Knowledge Bases</h1>
          <p className="text-sm text-muted-foreground">
            Upload documents and let agents query them for grounded answers.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Knowledge Base
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Knowledge Base</DialogTitle>
              <DialogDescription>Name your knowledge base and optionally add a description.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Product Docs" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Description</label>
                <Input
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="What kind of documents will this contain?"
                />
              </div>
              <Button
                className="w-full"
                disabled={!newName.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ name: newName.trim(), description: newDescription.trim() || undefined })}
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {basesQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : basesQuery.data?.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium">No knowledge bases yet</h3>
          <p className="text-xs text-muted-foreground mt-1">Create a knowledge base to start uploading documents.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {basesQuery.data?.map((kb) => (
            <KbCard key={kb.id} kb={kb} onDelete={(id) => deleteMutation.mutate(id)} isDeleting={deleteMutation.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

function KbCard({
  kb,
  onDelete,
  isDeleting,
}: {
  kb: KnowledgeBase;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <Link to={kb.id} className="text-sm font-medium hover:underline truncate block">
            {kb.name}
          </Link>
          {kb.description ? <p className="text-xs text-muted-foreground truncate">{kb.description}</p> : null}
          <p className="text-[10px] text-muted-foreground mt-0.5">Model: {kb.embeddingModel}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link to={kb.id}>
            <Search className="h-3.5 w-3.5" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon-sm" disabled={isDeleting} onClick={() => onDelete(kb.id)}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}
