import { useEffect, useState } from "react";
import { Link, useNavigate } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, Filter, FileText, Trash2 } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { socialMediaApi } from "../api/social-media";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SocialPost } from "@paperclipai/shared";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "proposed", label: "Proposed" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  proposed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function SocialMediaPosts() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Social Media", href: `/${selectedCompany?.issuePrefix}/social-media` },
      { label: "Posts" },
    ]);
  }, [setBreadcrumbs, selectedCompany]);

  const filters = statusFilter ? { status: statusFilter } : undefined;

  const { data: posts = [], isLoading } = useQuery({
    queryKey: queryKeys.socialMedia.posts(selectedCompanyId!, filters),
    queryFn: () => socialMediaApi.listPosts(selectedCompanyId!, filters),
    enabled: !!selectedCompanyId,
  });

  // Quick-create
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      socialMediaApi.createPost(selectedCompanyId!, { title: newTitle.trim() }),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialMedia.posts(selectedCompanyId!) });
      setShowCreate(false);
      setNewTitle("");
      navigate(`/${selectedCompany?.issuePrefix}/social-media/posts/${post.id}`);
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (postId: string) => socialMediaApi.deletePost(postId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialMedia.posts(selectedCompanyId!) });
      pushToast({ title: "Post deleted", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  if (!selectedCompanyId || !selectedCompany) return null;

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Draft, schedule, and publish social content</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Post
        </Button>
      </div>

      {/* Quick-create */}
      {showCreate && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">New Post</h3>
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Post title or campaign name…"
            onKeyDown={(e) => { if (e.key === "Enter" && newTitle.trim()) createMutation.mutate(); }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newTitle.trim()}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectCls + " max-w-[180px]"}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {statusFilter && (
          <button
            onClick={() => setStatusFilter("")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Posts list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading posts…
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {statusFilter ? `No ${statusFilter} posts.` : "No posts yet."}
          </p>
          {!statusFilter && (
            <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              Create your first post
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post: SocialPost) => (
            <div
              key={post.id}
              className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to={`/${selectedCompany.issuePrefix}/social-media/posts/${post.id}`}
                    className="text-sm font-medium hover:underline truncate"
                  >
                    {post.title}
                  </Link>
                  <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_BADGE[post.status] ?? "bg-muted"}`}>
                    {post.status}
                  </span>
                  {post.account && (
                    <span className="text-xs text-muted-foreground">
                      {post.account.platform} · {post.account.handle}
                    </span>
                  )}
                </div>
                {post.body && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{post.body}</p>
                )}
                {post.scheduledAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Scheduled: {new Date(post.scheduledAt).toLocaleString()}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.preventDefault(); deleteMutation.mutate(post.id); }}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                title="Delete post"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
