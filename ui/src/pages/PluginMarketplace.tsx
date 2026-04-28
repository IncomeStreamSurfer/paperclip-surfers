/**
 * @fileoverview Plugin Marketplace page — "ClipHub" MVP.
 *
 * Lists curated marketplace plugins with install buttons.
 * Each card shows name, description, author, category, and tags.
 *
 * @see doc/plans/2026-04-26-pro-plus-roadmap.md §20.1
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { MarketplacePlugin } from "@/api/plugins";
import { Link } from "@/lib/router";
import {
  Puzzle,
  Download,
  Check,
  Search,
  Tag,
  Store,
  ArrowLeft,
} from "lucide-react";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { pluginsApi } from "@/api/plugins";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useToast } from "@/context/ToastContext";
import { cn } from "@/lib/utils";

function PluginMarketplaceCard({
  plugin,
  onInstall,
  isInstalling,
}: {
  plugin: MarketplacePlugin;
  onInstall: (plugin: MarketplacePlugin) => void;
  isInstalling: boolean;
}) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
              <Puzzle className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold leading-tight">{plugin.displayName}</h3>
              <p className="text-xs text-muted-foreground">{plugin.author}</p>
            </div>
          </div>
          {plugin.installed ? (
            <Badge variant="secondary" className="gap-1">
              <Check className="h-3 w-3" />
              Installed
            </Badge>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={isInstalling}
              onClick={() => onInstall(plugin)}
              className="gap-1"
            >
              <Download className="h-3 w-3" />
              {isInstalling ? "Installing…" : "Install"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <p className="text-sm text-muted-foreground">{plugin.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {plugin.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs gap-1">
              <Tag className="h-2.5 w-2.5" />
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-muted-foreground">
        <span className="capitalize">{plugin.category}</span>
        {plugin.version && <span className="ml-auto">v{plugin.version}</span>}
      </CardFooter>
    </Card>
  );
}

export function PluginMarketplace() {
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [search, setSearch] = useState("");

  useEffect(() => {
    setBreadcrumbs([
      { label: "Instance Settings", href: "/instance/settings/general" },
      { label: "Plugin Marketplace" },
    ]);
  }, [setBreadcrumbs]);

  const { data: plugins, isLoading } = useQuery({
    queryKey: queryKeys.plugins.marketplace,
    queryFn: () => pluginsApi.listMarketplace(),
  });

  const installMutation = useMutation({
    mutationFn: (plugin: MarketplacePlugin) =>
      pluginsApi.install({ packageName: plugin.packageName }),
    onSuccess: () => {
      pushToast({ title: "Plugin installed successfully", tone: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.plugins.marketplace });
    },
    onError: (err) => {
      pushToast({ title: err instanceof Error ? err.message : "Install failed", tone: "error" });
    },
  });

  const filtered = useMemo(() => {
    if (!plugins) return [];
    const term = search.trim().toLowerCase();
    if (!term) return plugins;
    return plugins.filter(
      (p) =>
        p.displayName.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.tags.some((t) => t.toLowerCase().includes(term)) ||
        p.category.toLowerCase().includes(term),
    );
  }, [plugins, search]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Store className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold">Plugin Marketplace</h1>
          <p className="text-sm text-muted-foreground">
            Discover and install plugins to extend Paperclip.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/instance/settings/plugins">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-3.5 w-3.5" />
              Manage Plugins
            </Button>
          </Link>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search plugins by name, tag, or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading && (
        <div className="text-sm text-muted-foreground">Loading marketplace…</div>
      )}

      {filtered.length === 0 && !isLoading && (
        <div className="text-sm text-muted-foreground">
          {search ? "No plugins match your search." : "No marketplace plugins available."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((plugin) => (
          <PluginMarketplaceCard
            key={plugin.pluginKey}
            plugin={plugin}
            onInstall={(p) => installMutation.mutate(p)}
            isInstalling={installMutation.isPending && installMutation.variables?.pluginKey === plugin.pluginKey}
          />
        ))}
      </div>
    </div>
  );
}
