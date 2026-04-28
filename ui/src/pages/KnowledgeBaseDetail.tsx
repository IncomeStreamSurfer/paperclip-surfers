import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@/lib/router";
import { knowledgeApi } from "@/api/knowledge";
import { queryKeys } from "@/lib/queryKeys";
import { useToast } from "@/context/ToastContext";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { FileText, Trash2, Upload, Search, Loader2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { KnowledgeDocument, KbQueryResult } from "@paperclipai/shared";

export function KnowledgeBaseDetail() {
  const { selectedCompanyId: companyId } = useCompany();
  const { kbId } = useParams<{ kbId: string }>();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [queryText, setQueryText] = useState("");
  const [queryResults, setQueryResults] = useState<KbQueryResult[] | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const docsQuery = useQuery({
    queryKey: queryKeys.knowledge.documents(companyId ?? "", kbId ?? ""),
    queryFn: () => knowledgeApi.listDocuments(companyId!, kbId!),
    enabled: !!companyId && !!kbId,
  });

  const uploadMutation = useMutation({
    mutationFn: (data: { filename: string; content: string }) =>
      knowledgeApi.createDocument(companyId!, kbId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.documents(companyId ?? "", kbId ?? "") });
      pushToast({ title: "Document uploaded", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Upload failed", tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (docId: string) => knowledgeApi.deleteDocument(companyId!, kbId!, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.documents(companyId ?? "", kbId ?? "") });
      pushToast({ title: "Document deleted", tone: "success" });
    },
    onError: (err) => pushToast({ title: err instanceof Error ? err.message : "Delete failed", tone: "error" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    uploadMutation.mutate({ filename: file.name, content: text });
    e.target.value = "";
  };

  const handleSearch = async () => {
    if (!queryText.trim()) return;
    setIsQuerying(true);
    try {
      const res = await knowledgeApi.query(companyId!, kbId!, { query: queryText.trim(), topK: 5 });
      setQueryResults(res.results);
    } catch (err) {
      pushToast({ title: err instanceof Error ? err.message : "Search failed", tone: "error" });
    } finally {
      setIsQuerying(false);
    }
  };

  if (!companyId || !kbId) {
    return <div className="text-sm text-muted-foreground">Select a company and knowledge base.</div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-lg font-semibold">Knowledge Base</h1>
        <p className="text-sm text-muted-foreground">Upload documents and search the knowledge base.</p>
      </div>

      {/* Upload */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Upload Document</h2>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.txt,.mdx"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending}>
          {uploadMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Choose file
        </Button>
        <p className="text-xs text-muted-foreground">Supported: .md, .txt, .mdx</p>
      </div>

      {/* Search */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Search Playground</h2>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="Ask a question about your documents..."
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button size="sm" onClick={handleSearch} disabled={isQuerying || !queryText.trim()}>
            {isQuerying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          </Button>
        </div>
        {queryResults && (
          <div className="space-y-2 pt-2">
            {queryResults.length === 0 ? (
              <p className="text-xs text-muted-foreground">No results found.</p>
            ) : (
              queryResults.map((r, i) => (
                <div key={i} className="rounded-md border border-border p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground uppercase">{r.sourceFile}</span>
                    <span className="text-[10px] text-muted-foreground">Score: {(r.relevanceScore * 100).toFixed(1)}%</span>
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{r.text}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Documents */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Documents</h2>
        </div>
        {docsQuery.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : docsQuery.data?.length === 0 ? (
          <p className="text-xs text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {docsQuery.data?.map((doc) => (
              <DocRow key={doc.id} doc={doc} onDelete={() => deleteMutation.mutate(doc.id)} isDeleting={deleteMutation.isPending} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocRow({
  doc,
  onDelete,
  isDeleting,
}: {
  doc: KnowledgeDocument;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const statusIcon =
    doc.status === "ready" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> :
    doc.status === "failed" ? <AlertCircle className="h-3.5 w-3.5 text-destructive" /> :
    <Clock className="h-3.5 w-3.5 text-amber-500" />;

  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        {statusIcon}
        <span className="text-sm truncate">{doc.filename}</span>
        {doc.chunkCount != null ? (
          <span className="text-[10px] text-muted-foreground shrink-0">{doc.chunkCount} chunks</span>
        ) : null}
        {doc.error ? <span className="text-[10px] text-destructive shrink-0">{doc.error}</span> : null}
      </div>
      <Button variant="ghost" size="icon-sm" disabled={isDeleting} onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </div>
  );
}
