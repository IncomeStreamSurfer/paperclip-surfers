import { useEffect } from "react";
import { Link } from "@/lib/router";
import { useQuery } from "@tanstack/react-query";
import { Share2, Globe, FileText, CalendarClock, ArrowRight, Loader2 } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { socialMediaApi } from "../api/social-media";
import { queryKeys } from "../lib/queryKeys";
import type { SocialPost } from "@paperclipai/shared";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  proposed: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  published: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const ALL_STATUSES = ["draft", "proposed", "approved", "scheduled", "published", "rejected"];

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  href: string;
}) {
  return (
    <Link
      to={href}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent/30 transition-colors"
    >
      <div className="rounded-md bg-muted p-2 shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    </Link>
  );
}

export function SocialMediaOverview() {
  const { selectedCompanyId, selectedCompany } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const prefix = selectedCompany?.issuePrefix ?? "";

  useEffect(() => {
    setBreadcrumbs([{ label: "Social Media" }]);
  }, [setBreadcrumbs]);

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: queryKeys.socialMedia.accounts(selectedCompanyId!),
    queryFn: () => socialMediaApi.listAccounts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: posts = [], isLoading: loadingPosts } = useQuery({
    queryKey: queryKeys.socialMedia.posts(selectedCompanyId!),
    queryFn: () => socialMediaApi.listPosts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const isLoading = loadingAccounts || loadingPosts;

  // Derived counts
  const statusCounts = ALL_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = (posts as SocialPost[]).filter((p) => p.status === s).length;
    return acc;
  }, {});

  const upcoming = (posts as SocialPost[])
    .filter((p) => p.status === "scheduled" && p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
    .slice(0, 5);

  const recent = (posts as SocialPost[])
    .filter((p) => p.status === "published")
    .slice(0, 5);

  if (!selectedCompanyId) return null;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-muted p-2">
          <Share2 className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Social Media</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage accounts, draft posts, and track publishing
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard
              label="Connected Accounts"
              value={accounts.length}
              icon={Globe}
              href={`/${prefix}/social-media/accounts`}
            />
            <StatCard
              label="Total Posts"
              value={posts.length}
              icon={FileText}
              href={`/${prefix}/social-media/posts`}
            />
            <StatCard
              label="Scheduled"
              value={statusCounts.scheduled}
              icon={CalendarClock}
              href={`/${prefix}/social-media/posts`}
            />
          </div>

          {/* Status breakdown */}
          <div>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Posts by status
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {ALL_STATUSES.map((s) => (
                <Link
                  key={s}
                  to={`/${prefix}/social-media/posts`}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-center hover:bg-accent/30 transition-colors"
                >
                  <p className="text-xl font-bold">{statusCounts[s]}</p>
                  <span
                    className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 ${STATUS_BADGE[s]}`}
                  >
                    {s}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Upcoming scheduled */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Upcoming scheduled
              </h2>
              <div className="space-y-1.5">
                {upcoming.map((post) => (
                  <Link
                    key={post.id}
                    to={`/${prefix}/social-media/posts/${post.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent/30 transition-colors"
                  >
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm truncate">{post.title}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {post.scheduledAt
                        ? new Date(post.scheduledAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                    {post.account && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {post.account.platform} · {post.account.handle}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Recently published */}
          {recent.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
                Recently published
              </h2>
              <div className="space-y-1.5">
                {recent.map((post) => (
                  <Link
                    key={post.id}
                    to={`/${prefix}/social-media/posts/${post.id}`}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 hover:bg-accent/30 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="flex-1 text-sm truncate">{post.title}</span>
                    {post.account && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {post.account.platform} · {post.account.handle}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {accounts.length === 0 && posts.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Share2 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                No social media activity yet. Connect an account to get started.
              </p>
              <Link
                to={`/${prefix}/social-media/accounts`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                Connect an account <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {/* Quick links */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <Link
              to={`/${prefix}/social-media/accounts`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Globe className="h-3.5 w-3.5" /> Accounts
            </Link>
            <Link
              to={`/${prefix}/social-media/posts`}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <FileText className="h-3.5 w-3.5" /> All Posts
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
