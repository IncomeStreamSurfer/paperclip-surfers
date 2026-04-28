import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Share2, Plus, Trash2, Loader2, Globe } from "lucide-react";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { useToast } from "../context/ToastContext";
import { socialMediaApi } from "../api/social-media";
import { queryKeys } from "../lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SocialAccount } from "@paperclipai/shared";

const PLATFORM_LABELS: Record<string, string> = {
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
  facebook: "Facebook",
  youtube: "YouTube",
  pinterest: "Pinterest",
  threads: "Threads",
};

const PLATFORMS = Object.keys(PLATFORM_LABELS) as Array<keyof typeof PLATFORM_LABELS>;

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500",
  disconnected: "bg-yellow-500",
  error: "bg-red-500",
};

export function SocialMediaAccounts() {
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setBreadcrumbs([
      { label: "Social Media", href: `/${selectedCompanyId}/social-media` },
      { label: "Accounts" },
    ]);
  }, [setBreadcrumbs, selectedCompanyId]);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: queryKeys.socialMedia.accounts(selectedCompanyId!),
    queryFn: () => socialMediaApi.listAccounts(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Add account form state
  const [showAdd, setShowAdd] = useState(false);
  const [platform, setPlatform] = useState("twitter");
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notes, setNotes] = useState("");

  const createMutation = useMutation({
    mutationFn: () =>
      socialMediaApi.createAccount(selectedCompanyId!, {
        platform,
        handle: handle.trim(),
        displayName: displayName.trim() || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialMedia.accounts(selectedCompanyId!) });
      setShowAdd(false);
      setHandle("");
      setDisplayName("");
      setNotes("");
      pushToast({ title: "Account added", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (accountId: string) => socialMediaApi.deleteAccount(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.socialMedia.accounts(selectedCompanyId!) });
      pushToast({ title: "Account removed", tone: "success" });
    },
    onError: (err: Error) => pushToast({ title: err.message, tone: "error" }),
  });

  if (!selectedCompanyId) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your social media connections</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Account
        </Button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">Add Social Account</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Handle / Username</label>
              <Input
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="@yourhandle"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Display name (optional)</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Brand name"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this account"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !handle.trim()}
            >
              {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Account list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading accounts…
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-10 text-center">
          <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No social accounts connected yet.</p>
          <Button size="sm" className="mt-4" onClick={() => setShowAdd(true)}>
            Add your first account
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((account: SocialAccount) => (
            <div
              key={account.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[account.status] ?? "bg-muted"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {PLATFORM_LABELS[account.platform] ?? account.platform}
                  </span>
                  <span className="text-sm font-medium truncate">{account.handle}</span>
                  {account.displayName && (
                    <span className="text-xs text-muted-foreground truncate">· {account.displayName}</span>
                  )}
                </div>
                {account.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{account.notes}</p>
                )}
              </div>
              <button
                onClick={() => deleteMutation.mutate(account.id)}
                disabled={deleteMutation.isPending}
                className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Remove account"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pt-2 border-t border-border">
        <Link to="../social-media" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Social Media
        </Link>
      </div>
    </div>
  );
}
