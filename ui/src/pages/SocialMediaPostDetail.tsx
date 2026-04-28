import { useEffect, useState } from "react";
import { Link, useParams } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, ArrowLeft, Hash, Link2 } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { socialMediaApi } from "../api/social-media";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "proposed", label: "Proposed" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
];

const selectCls =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function SocialMediaPostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const { data: post, isLoading } = useQuery({
    queryKey: queryKeys.socialMedia.post(postId!),
    queryFn: () => socialMediaApi.getPost(postId!),
    enabled: !!postId,
  });

  // Accounts for selector
  const { data: accounts = [] } = useQuery({
    queryKey: queryKeys.socialMedia.accounts(selectedCompanyId!),
    queryFn: () => socialMediaApi.listAccounts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("draft");
  const [accountId, setAccountId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [link, setLink] = useState("");

  useEffect(() => {
    if (post) {
      setTitle(post.title);
      setBody(post.body ?? "");
      setStatus(post.status);
      setAccountId(post.accountId ?? "");
      setScheduledAt(
        post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : "",
      );
      setHashtags((post.data?.hashtags ?? []).join(" "));
      setLink(post.data?.link ?? "");
    }
  }, [post]);

  useEffect(() => {
    if (post) {
      setBreadcrumbs([
        { label: "Social Media", href: `/${selectedCompany?.issuePrefix}/social-media` },
        { label: "Posts", href: `/${selectedCompany?.issuePrefix}/social-media/posts` },
        { label: post.title },
      ]);
    }
  }, [post, setBreadcrumbs, selectedCompany]);

  const saveMutation = useMutation({
    mutationFn: () =>
      socialMediaApi.updatePost(postId!, {
        title: title.trim(),
        body: body.trim(),
        status,
        accountId: accountId || null,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        data: {
          hashtags: hashtags
            .split(/[\s,]+/)
            .map((h) => h.replace(/^#/, "").trim())
            .filter(Boolean),
          link: link.trim() || null,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialMedia.post(postId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.socialMedia.posts(selectedCompanyId!) });
      pushToast({ title: "Post saved", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  if (isLoading || !post) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading post…
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 py-4">
      <div className="flex items-center gap-3">
        <Link
          to={`/${selectedCompany?.issuePrefix}/social-media/posts`}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-bold flex-1 truncate">{post.title}</h1>
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !title.trim()}
        >
          {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
          Save
        </Button>
      </div>

      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Title / Campaign name</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        {/* Status + Account row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectCls}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Account</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={selectCls}
            >
              <option value="">— None —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.platform} · {a.handle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Post body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="Write your post content here…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
          />
          <p className="text-[10px] text-muted-foreground text-right mt-0.5">{body.length} chars</p>
        </div>

        {/* Hashtags */}
        <div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Hash className="h-3 w-3" />
            Hashtags (space or comma separated)
          </label>
          <Input
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#ai #socialmedia #marketing"
          />
        </div>

        {/* Link */}
        <div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
            <Link2 className="h-3 w-3" />
            Link URL (optional)
          </label>
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com/post"
            type="url"
          />
        </div>

        {/* Schedule */}
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Schedule for (optional)</label>
          <Input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
